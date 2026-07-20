import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Surreal } from "surrealdb";
import type { Config, Connection, MigrationFormat } from "../../config.ts";
import { resolveMigrationFormat } from "../../config.ts";
import {
  fetchAppliedMigrationsOn,
  markMigrationApplied,
  markMigrationReverted,
  withConnection,
  type AppliedMigration,
} from "../../db.ts";
import {
  getConnectionCredentials,
  type ConnectionCredentials,
} from "../../env.ts";
import { assertFormatSupported } from "../../flags.ts";
import { connectionMigrationsDir } from "./create.ts";
import { listLocalMigrationIds } from "./status.ts";

export type RunOutcome = {
  processed: string[];
  /** Applied ids skipped because local up/down source files are missing. */
  skipped: string[];
};

export type RunResult =
  | { ok: true; processed: string[]; skipped: string[] }
  | { ok: false; error: string; processed: string[]; skipped: string[] };

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

/**
 * Fail fast when local migration files are missing for the given ids.
 * Used before apply so ENOENT is not hit mid-batch.
 */
export async function assertMigrationSources(
  options: MigrationRunOptions,
  ids: string[],
  direction: "up" | "down",
): Promise<void> {
  if (ids.length === 0) return;
  const { dir } = resolveRunPaths(options);
  const missing: string[] = [];

  for (const id of ids) {
    const files = migrationFilePaths(options.format, dir, id);
    const filePath = direction === "up" ? files.up : files.down;
    if (!(await Bun.file(filePath).exists())) {
      missing.push(id);
    }
  }

  if (missing.length === 0) return;

  const label = missing.length === 1 ? missing[0]! : missing.join(", ");
  throw new Error(
    `Missing local source for ${label}. Restore the files or delete the migration record(s) in the migration manager.`,
  );
}

/** Split ids into those with local source files and those without. */
export async function partitionMigrationSources(
  options: MigrationRunOptions,
  ids: string[],
  direction: "up" | "down",
): Promise<{ ready: string[]; skipped: string[] }> {
  if (ids.length === 0) return { ready: [], skipped: [] };
  const { dir } = resolveRunPaths(options);
  const ready: string[] = [];
  const skipped: string[] = [];

  for (const id of ids) {
    const files = migrationFilePaths(options.format, dir, id);
    const filePath = direction === "up" ? files.up : files.down;
    if (await Bun.file(filePath).exists()) {
      ready.push(id);
    } else {
      skipped.push(id);
    }
  }

  return { ready, skipped };
}

async function revertMigrations(
  db: Surreal,
  options: MigrationRunOptions,
  migrations: AppliedMigration[],
): Promise<RunOutcome> {
  const { dir } = resolveRunPaths(options);
  const { ready, skipped } = await partitionMigrationSources(
    options,
    migrations.map((m) => m.id),
    "down",
  );
  const readySet = new Set(ready);
  const processed: string[] = [];

  for (const migration of migrations) {
    if (!readySet.has(migration.id)) continue;
    await runDown(db, options.format, dir, migration.id);
    await markMigrationReverted(db, options.migrationTable, migration.id);
    processed.push(migration.id);
  }

  return { processed, skipped };
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

  await assertMigrationSources(options, pending, "up");

  const batchNumber = nextBatchNumber(applied);
  const processed: string[] = [];

  for (const id of pending) {
    await runUp(db, options.format, dir, id);
    await markMigrationApplied(db, options.migrationTable, id, batchNumber);
    processed.push(id);
  }

  return processed;
}

/**
 * Apply pending migrations with id <= selected (lexical), as one batch.
 * Includes the selected id when it is still pending.
 */
export async function applyPendingThrough(
  db: Surreal,
  options: MigrationRunOptions,
  throughId: string,
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
  const pending = local.filter(
    (id) => !appliedSet.has(id) && id.localeCompare(throughId) <= 0,
  );
  if (pending.length === 0) return [];

  await assertMigrationSources(options, pending, "up");

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

  await assertMigrationSources(options, [id], "up");

  const batchNumber = nextBatchNumber(applied);
  await runUp(db, options.format, dir, id);
  await markMigrationApplied(db, options.migrationTable, id, batchNumber);
  return [id];
}

/** Roll back the latest batch on an open DB session. */
export async function revertLatestBatch(
  db: Surreal,
  options: MigrationRunOptions,
): Promise<RunOutcome> {
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  if (applied.length === 0) return { processed: [], skipped: [] };

  const latestBatch = Math.max(...applied.map((m) => m.batchNumber));
  const batch = applied
    .filter((m) => m.batchNumber === latestBatch)
    .sort(sortForRollback);

  return revertMigrations(db, options, batch);
}

/** Roll back every applied migration on an open DB session. */
export async function revertAllApplied(
  db: Surreal,
  options: MigrationRunOptions,
): Promise<RunOutcome> {
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  const ordered = [...applied].sort(sortForRollback);
  return revertMigrations(db, options, ordered);
}

/** Roll back a single migration by id (allows holes). */
export async function revertMigration(
  db: Surreal,
  options: MigrationRunOptions,
  id: string,
): Promise<RunOutcome> {
  const { dir } = resolveRunPaths(options);
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  if (!applied.some((m) => m.id === id)) {
    return { processed: [], skipped: [] };
  }

  const { ready, skipped } = await partitionMigrationSources(
    options,
    [id],
    "down",
  );
  if (ready.length === 0) {
    return { processed: [], skipped };
  }

  await runDown(db, options.format, dir, id);
  await markMigrationReverted(db, options.migrationTable, id);
  return { processed: [id], skipped: [] };
}

/**
 * Remove the applied migration row from the DB without running down.
 * For stuck mismatch cleanup only — does not change schema/data.
 */
export async function forgetMigrationRecord(
  db: Surreal,
  options: MigrationRunOptions,
  id: string,
): Promise<string[]> {
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  if (!applied.some((m) => m.id === id)) return [];

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
): Promise<RunOutcome> {
  const applied = await fetchAppliedMigrationsOn(db, options.migrationTable);
  const after = applied
    .filter((m) => m.id.localeCompare(id) > 0)
    .sort(sortForRollback);

  return revertMigrations(db, options, after);
}

function normalizeOutcome(
  result: RunOutcome | string[],
): RunOutcome {
  if (Array.isArray(result)) {
    return { processed: result, skipped: [] };
  }
  return result;
}

export async function runWithConnection(
  config: Config,
  connection: Connection,
  cwd: string,
  run: (
    db: Surreal,
    options: MigrationRunOptions,
  ) => Promise<RunOutcome | string[]>,
): Promise<RunResult> {
  const format = resolveMigrationFormat(config, connection);
  const unsupported = assertFormatSupported(format);
  if (unsupported) {
    return { ok: false, error: unsupported, processed: [], skipped: [] };
  }

  const credentials = requireCredentials(connection.name);
  if ("error" in credentials) {
    return { ok: false, error: credentials.error, processed: [], skipped: [] };
  }

  const options: MigrationRunOptions = {
    migrationsDir: config.migrationsDir,
    connectionName: connection.name,
    migrationTable: connection.migrationTable,
    format,
    cwd,
  };

  let outcome: RunOutcome = { processed: [], skipped: [] };
  const result = await withConnection(connection, credentials, async (db) => {
    outcome = normalizeOutcome(await run(db, options));
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      processed: outcome.processed,
      skipped: outcome.skipped,
    };
  }
  return { ok: true, ...outcome };
}
