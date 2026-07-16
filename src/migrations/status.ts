import { readdir } from "node:fs/promises";
import type { Config, Connection, MigrationFormat } from "../config.ts";
import { fetchAppliedMigrationIds } from "../db.ts";
import {
  getConnectionCredentials,
  type ConnectionCredentials,
} from "../env.ts";
import { connectionMigrationsDir } from "./create.ts";

export type MigrationStatus = {
  local: string[];
  applied: string[];
  pending: string[];
  error?: string;
};

/** Extract migration id from a filename based on format. */
export function migrationIdFromFilename(
  filename: string,
  format: MigrationFormat,
): string | null {
  if (format === "surql") {
    const match = /^(.*)\.up\.surql$/.exec(filename);
    return match?.[1] ?? null;
  }
  if (filename.endsWith(".ts") && !filename.endsWith(".d.ts")) {
    return filename.slice(0, -".ts".length);
  }
  return null;
}

export async function listLocalMigrationIds(
  migrationsDir: string,
  connectionName: string,
  format: MigrationFormat,
  cwd = process.cwd(),
): Promise<string[]> {
  const dir = connectionMigrationsDir(migrationsDir, connectionName, cwd);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const ids = entries
    .map((name) => migrationIdFromFilename(name, format))
    .filter((id): id is string => id !== null);

  return [...new Set(ids)].sort();
}

export async function getMigrationStatus(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<MigrationStatus> {
  if (!config.migrationFormat) {
    return { local: [], applied: [], pending: [] };
  }

  const local = await listLocalMigrationIds(
    config.migrationsDir,
    connection.name,
    config.migrationFormat,
    cwd,
  );

  const creds = getConnectionCredentials(connection.name);
  if (!creds.username || !creds.password) {
    return {
      local,
      applied: [],
      pending: local,
      error: "Missing credentials in .env",
    };
  }

  const credentials: ConnectionCredentials = {
    username: creds.username,
    password: creds.password,
  };

  const appliedResult = await fetchAppliedMigrationIds(connection, credentials);
  if (!appliedResult.ok) {
    return {
      local,
      applied: [],
      pending: local,
      error: appliedResult.error,
    };
  }

  const appliedSet = new Set(appliedResult.ids);
  const pending = local.filter((id) => !appliedSet.has(id));

  return { local, applied: appliedResult.ids, pending };
}

export function formatPendingHint(status: MigrationStatus): string {
  if (status.error && status.pending.length === 0) {
    return "status unavailable";
  }
  if (status.pending.length === 0) {
    return "up to date";
  }
  return `${status.pending.length} pending`;
}

export function formatPendingOverview(status: MigrationStatus): string[] {
  const lines: string[] = [];

  if (status.error) {
    lines.push(`Could not verify applied migrations: ${status.error}`);
  }

  if (status.pending.length === 0) {
    lines.push(
      status.error ? "Local migrations may be pending." : "No pending migrations.",
    );
    return lines;
  }

  lines.push(
    status.pending.length === 1
      ? "1 pending migration:"
      : `${status.pending.length} pending migrations:`,
  );
  for (const id of status.pending) {
    lines.push(`  • ${id}`);
  }
  return lines;
}
