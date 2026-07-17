import path from "node:path";
import { pathToFileURL } from "node:url";
import { Table, surql, type Surreal } from "surrealdb";
import type { Config, Connection, MigrationFormat } from "../config.ts";
import {
  markMigrationApplied,
  markMigrationReverted,
  recordIdKey,
  withConnection,
  type AppliedMigration,
} from "../db.ts";
import {
  getConnectionCredentials,
  type ConnectionCredentials,
} from "../env.ts";
import { connectionMigrationsDir } from "./create.ts";
import { getMigrationStatus } from "./status.ts";

export type RunResult =
  | { ok: true; processed: string[] }
  | { ok: false; error: string; processed: string[] };

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

async function loadApplied(db: Surreal, tableName: string): Promise<AppliedMigration[]> {
  const table = new Table(tableName);
  const rows = await db
    .query<{ id: unknown; batchNumber?: number; appliedAt?: unknown }[][]>(
      surql`SELECT id, batchNumber, appliedAt FROM ${table}`,
    )
    .collect();

  return (rows[0] ?? [])
    .map((row) => {
      const id = recordIdKey(row.id);
      if (!id) return null;
      return {
        id,
        batchNumber: Number(row.batchNumber ?? 0),
        appliedAt: row.appliedAt,
      } satisfies AppliedMigration;
    })
    .filter((row): row is AppliedMigration => row !== null);
}

function nextBatchNumber(applied: AppliedMigration[]): number {
  if (applied.length === 0) return 1;
  return Math.max(...applied.map((m) => m.batchNumber)) + 1;
}

function sortForRollback(a: AppliedMigration, b: AppliedMigration): number {
  if (a.batchNumber !== b.batchNumber) return b.batchNumber - a.batchNumber;
  return b.id.localeCompare(a.id);
}

export async function migrateUp(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  if (!config.migrationFormat) {
    return {
      ok: false,
      error: "Migration format is not configured",
      processed: [],
    };
  }

  const credentials = requireCredentials(connection.name);
  if ("error" in credentials) {
    return { ok: false, error: credentials.error, processed: [] };
  }

  const status = await getMigrationStatus(config, connection, cwd);
  if (status.pending.length === 0) {
    return { ok: true, processed: [] };
  }

  const dir = connectionMigrationsDir(
    config.migrationsDir,
    connection.name,
    cwd,
  );
  const format = config.migrationFormat;
  const processed: string[] = [];

  const result = await withConnection(connection, credentials, async (db) => {
    const applied = await loadApplied(db, connection.migrationTable);
    const batchNumber = nextBatchNumber(applied);

    for (const id of status.pending) {
      await runUp(db, format, dir, id);
      await markMigrationApplied(
        db,
        connection.migrationTable,
        id,
        batchNumber,
      );
      processed.push(id);
    }
  });

  if (!result.ok) {
    return { ok: false, error: result.error, processed };
  }
  return { ok: true, processed };
}

export async function rollbackBatch(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  if (!config.migrationFormat) {
    return {
      ok: false,
      error: "Migration format is not configured",
      processed: [],
    };
  }

  const credentials = requireCredentials(connection.name);
  if ("error" in credentials) {
    return { ok: false, error: credentials.error, processed: [] };
  }

  const dir = connectionMigrationsDir(
    config.migrationsDir,
    connection.name,
    cwd,
  );
  const format = config.migrationFormat;
  const processed: string[] = [];

  const result = await withConnection(connection, credentials, async (db) => {
    const applied = await loadApplied(db, connection.migrationTable);
    if (applied.length === 0) return;

    const latestBatch = Math.max(...applied.map((m) => m.batchNumber));
    const batch = applied
      .filter((m) => m.batchNumber === latestBatch)
      .sort(sortForRollback);

    for (const migration of batch) {
      await runDown(db, format, dir, migration.id);
      await markMigrationReverted(
        db,
        connection.migrationTable,
        migration.id,
      );
      processed.push(migration.id);
    }
  });

  if (!result.ok) {
    return { ok: false, error: result.error, processed };
  }
  return { ok: true, processed };
}

export async function rollbackAll(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  if (!config.migrationFormat) {
    return {
      ok: false,
      error: "Migration format is not configured",
      processed: [],
    };
  }

  const credentials = requireCredentials(connection.name);
  if ("error" in credentials) {
    return { ok: false, error: credentials.error, processed: [] };
  }

  const dir = connectionMigrationsDir(
    config.migrationsDir,
    connection.name,
    cwd,
  );
  const format = config.migrationFormat;
  const processed: string[] = [];

  const result = await withConnection(connection, credentials, async (db) => {
    const applied = await loadApplied(db, connection.migrationTable);
    const ordered = [...applied].sort(sortForRollback);

    for (const migration of ordered) {
      await runDown(db, format, dir, migration.id);
      await markMigrationReverted(
        db,
        connection.migrationTable,
        migration.id,
      );
      processed.push(migration.id);
    }
  });

  if (!result.ok) {
    return { ok: false, error: result.error, processed };
  }
  return { ok: true, processed };
}
