import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Surreal } from "surrealdb";
import type { Config, Connection, MigrationFormat } from "../config.ts";
import { resolveMigrationFormat } from "../config.ts";
import {
  fetchAppliedMigrationsOn,
  markMigrationApplied,
  markMigrationReverted,
  withConnection,
  type AppliedMigration,
} from "../db.ts";
import {
  getConnectionCredentials,
  type ConnectionCredentials,
} from "../env.ts";
import { assertFormatSupported } from "../features.ts";
import { connectionMigrationsDir } from "./create.ts";
import { listLocalMigrationIds } from "./status.ts";

export type RunResult =
  | { ok: true; processed: string[] }
  | { ok: false; error: string; processed: string[] };

export type MigrationRunOptions = {
  migrationsDir: string;
  connectionName: string;
  migrationTable: string;
  format: MigrationFormat;
  cwd?: string;
};

type TsMigrationModule = {
  up?: (db: Surreal) => Promise<void>;
  down?: (db: Surreal) => Promise<void>;
};

function requireCredentials(
  connectionName: string,
): ConnectionCredentials | { error: string } {
  const creds = getConnectionCredentials(connectionName);
  if (!creds.username || !creds.password) {
    return { error: "Missing credentials in .env" };
  }
  return { username: creds.username, password: creds.password };
}

function migrationFilePaths(
  format: MigrationFormat,
  dir: string,
  id: string,
): { up: string; down: string } {
  if (format === "surql") {
    return {
      up: path.join(dir, `${id}.up.surql`),
      down: path.join(dir, `${id}.down.surql`),
    };
  }
  const file = path.join(dir, `${id}.ts`);
  return { up: file, down: file };
}

async function runSurqlFile(db: Surreal, filePath: string): Promise<void> {
  const sql = await Bun.file(filePath).text();
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
  if (!withoutComments) return;
  await db.query(sql).collect();
}

async function loadTsModule(filePath: string): Promise<TsMigrationModule> {
  return (await import(pathToFileURL(filePath).href)) as TsMigrationModule;
}

async function runUp(
  db: Surreal,
  format: MigrationFormat,
  dir: string,
  id: string,
): Promise<void> {
  const files = migrationFilePaths(format, dir, id);
  if (format === "surql") {
    await runSurqlFile(db, files.up);
    return;
  }
  const mod = await loadTsModule(files.up);
  if (typeof mod.up !== "function") {
    throw new Error(`Migration "${id}" is missing an up() export`);
  }
  await mod.up(db);
}

async function runDown(
  db: Surreal,
  format: MigrationFormat,
  dir: string,
  id: string,
): Promise<void> {
  const files = migrationFilePaths(format, dir, id);
  if (format === "surql") {
    await runSurqlFile(db, files.down);
    return;
  }
  const mod = await loadTsModule(files.down);
  if (typeof mod.down !== "function") {
    throw new Error(`Migration "${id}" is missing a down() export`);
  }
  await mod.down(db);
}

export function nextBatchNumber(applied: AppliedMigration[]): number {
  if (applied.length === 0) return 1;
  return Math.max(...applied.map((m) => m.batchNumber)) + 1;
}

export function sortForRollback(
  a: AppliedMigration,
  b: AppliedMigration,
): number {
  if (a.batchNumber !== b.batchNumber) return b.batchNumber - a.batchNumber;
  return b.id.localeCompare(a.id);
}

function resolveRunPaths(options: MigrationRunOptions): {
  cwd: string;
  dir: string;
} {
  const cwd = options.cwd ?? process.cwd();
  return {
    cwd,
    dir: connectionMigrationsDir(
      options.migrationsDir,
      options.connectionName,
      cwd,
    ),
  };
}

/** Apply all pending migrations on an open DB session (same batch). */
export async function applyPendingMigrations(
  db: Surreal,
  options: MigrationRunOptions,
): Promise<string[]> {
  const { cwd, dir } = resolveRunPaths(options);
  const local = await listLocalMigrationIds(
    options.migrationsDir,
    options.connectionName,
    options.format,
    cwd,
  );
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  const appliedSet = new Set(applied.map((m) => m.id));
  const pending = local.filter((id) => !appliedSet.has(id));
  if (pending.length === 0) return [];

  const batchNumber = nextBatchNumber(applied);
  const processed: string[] = [];

  for (const id of pending) {
    await runUp(db, options.format, dir, id);
    await markMigrationApplied(db, options.migrationTable, id, batchNumber);
    processed.push(id);
  }

  return processed;
}

/** Apply a single migration by id (allows out-of-order / holes). */
export async function applyMigration(
  db: Surreal,
  options: MigrationRunOptions,
  id: string,
): Promise<string[]> {
  const { dir } = resolveRunPaths(options);
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  if (applied.some((m) => m.id === id)) return [];

  const batchNumber = nextBatchNumber(applied);
  await runUp(db, options.format, dir, id);
  await markMigrationApplied(db, options.migrationTable, id, batchNumber);
  return [id];
}

/** Roll back the latest batch on an open DB session. */
export async function revertLatestBatch(
  db: Surreal,
  options: MigrationRunOptions,
): Promise<string[]> {
  const { dir } = resolveRunPaths(options);
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  if (applied.length === 0) return [];

  const latestBatch = Math.max(...applied.map((m) => m.batchNumber));
  const batch = applied
    .filter((m) => m.batchNumber === latestBatch)
    .sort(sortForRollback);

  const processed: string[] = [];
  for (const migration of batch) {
    await runDown(db, options.format, dir, migration.id);
    await markMigrationReverted(db, options.migrationTable, migration.id);
    processed.push(migration.id);
  }
  return processed;
}

/** Roll back every applied migration on an open DB session. */
export async function revertAllApplied(
  db: Surreal,
  options: MigrationRunOptions,
): Promise<string[]> {
  const { dir } = resolveRunPaths(options);
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  const ordered = [...applied].sort(sortForRollback);

  const processed: string[] = [];
  for (const migration of ordered) {
    await runDown(db, options.format, dir, migration.id);
    await markMigrationReverted(db, options.migrationTable, migration.id);
    processed.push(migration.id);
  }
  return processed;
}

/** Roll back a single migration by id (allows holes). */
export async function revertMigration(
  db: Surreal,
  options: MigrationRunOptions,
  id: string,
): Promise<string[]> {
  const { dir } = resolveRunPaths(options);
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  if (!applied.some((m) => m.id === id)) return [];

  await runDown(db, options.format, dir, id);
  await markMigrationReverted(db, options.migrationTable, id);
  return [id];
}

/**
 * Roll back every applied migration with id > selected (lexical).
 * The selected migration stays applied.
 */
export async function revertMigrationsAfter(
  db: Surreal,
  options: MigrationRunOptions,
  id: string,
): Promise<string[]> {
  const { dir } = resolveRunPaths(options);
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  const after = applied
    .filter((m) => m.id.localeCompare(id) > 0)
    .sort(sortForRollback);

  const processed: string[] = [];
  for (const migration of after) {
    await runDown(db, options.format, dir, migration.id);
    await markMigrationReverted(db, options.migrationTable, migration.id);
    processed.push(migration.id);
  }
  return processed;
}

async function runWithConnection(
  config: Config,
  connection: Connection,
  cwd: string,
  run: (db: Surreal, options: MigrationRunOptions) => Promise<string[]>,
): Promise<RunResult> {
  const format = resolveMigrationFormat(config, connection);
  const unsupported = assertFormatSupported(format);
  if (unsupported) {
    return { ok: false, error: unsupported, processed: [] };
  }

  const credentials = requireCredentials(connection.name);
  if ("error" in credentials) {
    return { ok: false, error: credentials.error, processed: [] };
  }

  const options: MigrationRunOptions = {
    migrationsDir: config.migrationsDir,
    connectionName: connection.name,
    migrationTable: connection.migrationTable,
    format,
    cwd,
  };

  const processed: string[] = [];
  const result = await withConnection(connection, credentials, async (db) => {
    processed.push(...(await run(db, options)));
  });

  if (!result.ok) {
    return { ok: false, error: result.error, processed };
  }
  return { ok: true, processed };
}

export async function migrateUp(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, applyPendingMigrations);
}

export async function migrateOne(
  config: Config,
  connection: Connection,
  id: string,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, (db, options) =>
    applyMigration(db, options, id),
  );
}

export async function rollbackBatch(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, revertLatestBatch);
}

export async function rollbackAll(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, revertAllApplied);
}

export async function rollbackOne(
  config: Config,
  connection: Connection,
  id: string,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, (db, options) =>
    revertMigration(db, options, id),
  );
}

export async function rollbackAfter(
  config: Config,
  connection: Connection,
  id: string,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, (db, options) =>
    revertMigrationsAfter(db, options, id),
  );
}
