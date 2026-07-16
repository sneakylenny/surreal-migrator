import { Surreal, Table } from "surrealdb";
import type { Connection } from "./config.ts";
import type { ConnectionCredentials } from "./env.ts";

export type DbResult = { ok: true } | { ok: false; error: string };

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
