import { Surreal } from "surrealdb";
import type { Connection } from "./config.ts";
import type { ConnectionCredentials } from "./env.ts";

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyConnection(
  connection: Pick<Connection, "endpoint" | "namespace" | "database">,
  credentials: ConnectionCredentials,
): Promise<VerifyResult> {
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
