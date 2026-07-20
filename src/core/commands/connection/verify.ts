import type { Connection } from "../../config.ts";
import {
  ensureMigrationTable,
  verifyConnection,
} from "../../db.ts";
import type { ConnectionCredentials } from "../../env.ts";

export type VerifyConnectionResult =
  | { ok: true }
  | { ok: false; error: string; stage: "verify" | "table" };

/**
 * Check that the endpoint accepts credentials, then optionally ensure the
 * migration tracking table exists. Does not write config or .env.
 */
export async function verifyConnectionConnectivity(
  connection: Pick<
    Connection,
    "endpoint" | "namespace" | "database" | "migrationTable"
  >,
  credentials: ConnectionCredentials,
  options?: { ensureTable?: boolean },
): Promise<VerifyConnectionResult> {
  const ensureTable = options?.ensureTable ?? true;

  const verified = await verifyConnection(connection, credentials);
  if (!verified.ok) {
    return { ok: false, error: verified.error, stage: "verify" };
  }

  if (ensureTable) {
    const table = await ensureMigrationTable(connection, credentials);
    if (!table.ok) {
      return { ok: false, error: table.error, stage: "table" };
    }
  }

  return { ok: true };
}
