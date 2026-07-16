import { Surreal, Table, surql } from "surrealdb";
import type { Connection } from "./config.ts";
import type { ConnectionCredentials } from "./env.ts";

export type DbResult = { ok: true } | { ok: false; error: string };

export type AppliedMigrationsResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

async function withConnection(
  connection: Pick<Connection, "endpoint" | "namespace" | "database">,
  credentials: ConnectionCredentials,
  run: (db: Surreal) => Promise<void>,
): Promise<DbResult> {
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
    await run(db);
    return { ok: true };
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
  return withConnection(connection, credentials, async () => {
    // connect success is enough
  });
}

export async function ensureMigrationTable(
  connection: Pick<
    Connection,
    "endpoint" | "namespace" | "database" | "migrationTable"
  >,
  credentials: ConnectionCredentials,
): Promise<DbResult> {
  return withConnection(connection, credentials, async (db) => {
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

export async function fetchAppliedMigrationIds(
  connection: Pick<
    Connection,
    "endpoint" | "namespace" | "database" | "migrationTable"
  >,
  credentials: ConnectionCredentials,
): Promise<AppliedMigrationsResult> {
  let ids: string[] = [];

  const result = await withConnection(connection, credentials, async (db) => {
    const table = new Table(connection.migrationTable);
    const rows = await db
      .query<{ id: unknown }[][]>(surql`SELECT id FROM ${table}`)
      .collect();

    const records = rows[0] ?? [];
    ids = records
      .map((row) => recordIdKey(row.id))
      .filter((id): id is string => Boolean(id))
      .sort();
  });

  if (!result.ok) return result;
  return { ok: true, ids };
}
