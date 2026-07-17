import { RecordId, Surreal, Table, surql } from "surrealdb";
import type { Connection } from "./config.ts";
import type { ConnectionCredentials } from "./env.ts";

export type DbResult = { ok: true } | { ok: false; error: string };

export type DbValueResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type AppliedMigration = {
  id: string;
  batchNumber: number;
  appliedAt: unknown;
};

export type AppliedMigrationsResult =
  | { ok: true; migrations: AppliedMigration[] }
  | { ok: false; error: string };

export async function withConnection<T>(
  connection: Pick<Connection, "endpoint" | "namespace" | "database">,
  credentials: ConnectionCredentials,
  run: (db: Surreal) => Promise<T>,
): Promise<DbValueResult<T>> {
  const db = new Surreal();
  try {
    await db.connect(connection.endpoint, {
      namespace: connection.namespace,
      database: connection.database,
      authentication: {
        username: credentials.username,
        password: credentials.password,
      },
    });
    const value = await run(db);
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    try {
      await db.close();
    } catch {
      // ignore close errors after a failed connect
    }
  }
}

export async function verifyConnection(
  connection: Pick<Connection, "endpoint" | "namespace" | "database">,
  credentials: ConnectionCredentials,
): Promise<DbResult> {
  const result = await withConnection(connection, credentials, async () => {});
  return result.ok ? { ok: true } : result;
}

export async function ensureMigrationTable(
  connection: Pick<
    Connection,
    "endpoint" | "namespace" | "database" | "migrationTable"
  >,
  credentials: ConnectionCredentials,
): Promise<DbResult> {
  const result = await withConnection(connection, credentials, async (db) => {
    await db
      .query(
        /* surql */ `
DEFINE TABLE IF NOT EXISTS $table SCHEMALESS;
DEFINE FIELD IF NOT EXISTS batchNumber ON $table TYPE number;
DEFINE FIELD IF NOT EXISTS appliedAt ON $table TYPE datetime;
`,
        { table: connection.migrationTable },
      )
      .collect();
  });
  return result.ok ? { ok: true } : result;
}

/** Strip Surreal record-id brackets if present. */
export function recordIdKey(value: unknown): string | null {
  if (value == null) return null;

  let key: string;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (id == null) return null;
    key = String(id);
  } else {
    const text = String(value);
    const idx = text.indexOf(":");
    key = idx >= 0 ? text.slice(idx + 1) : text;
  }

  return key.replace(/^⟨/, "").replace(/⟩$/, "");
}

export async function fetchAppliedMigrations(
  connection: Pick<
    Connection,
    "endpoint" | "namespace" | "database" | "migrationTable"
  >,
  credentials: ConnectionCredentials,
): Promise<AppliedMigrationsResult> {
  const result = await withConnection(connection, credentials, async (db) => {
    const table = new Table(connection.migrationTable);
    const rows = await db
      .query<
        { id: unknown; batchNumber?: number; appliedAt?: unknown }[][]
      >(surql`SELECT id, batchNumber, appliedAt FROM ${table}`)
      .collect();

    const records = rows[0] ?? [];
    return records
      .map((row) => {
        const id = recordIdKey(row.id);
        if (!id) return null;
        return {
          id,
          batchNumber: Number(row.batchNumber ?? 0),
          appliedAt: row.appliedAt,
        } satisfies AppliedMigration;
      })
      .filter((row): row is AppliedMigration => row !== null)
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  if (!result.ok) return result;
  return { ok: true, migrations: result.value };
}

/** @deprecated Prefer fetchAppliedMigrations */
export async function fetchAppliedMigrationIds(
  connection: Pick<
    Connection,
    "endpoint" | "namespace" | "database" | "migrationTable"
  >,
  credentials: ConnectionCredentials,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const result = await fetchAppliedMigrations(connection, credentials);
  if (!result.ok) return result;
  return { ok: true, ids: result.migrations.map((m) => m.id) };
}

export async function markMigrationApplied(
  db: Surreal,
  tableName: string,
  migrationId: string,
  batchNumber: number,
): Promise<void> {
  await db
    .create(new RecordId(tableName, migrationId))
    .content({
      batchNumber,
      appliedAt: new Date(),
    });
}

export async function markMigrationReverted(
  db: Surreal,
  tableName: string,
  migrationId: string,
): Promise<void> {
  await db.delete(new RecordId(tableName, migrationId));
}
