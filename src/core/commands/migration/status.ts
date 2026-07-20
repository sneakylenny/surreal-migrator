import { readdir } from "node:fs/promises";
import type { Config, Connection, MigrationFormat } from "../../config.ts";
import { resolveMigrationFormat } from "../../config.ts";
import { fetchAppliedMigrations } from "../../db.ts";
import {
  getConnectionCredentials,
  type ConnectionCredentials,
} from "../../env.ts";
import { assertFormatSupported } from "../../flags.ts";
import { connectionMigrationsDir } from "./create.ts";

export type MigrationStatus = {
  local: string[];
  applied: string[];
  pending: string[];
  /** Applied in the DB but no matching local migration files. */
  missing: string[];
  /** Number of migrations in the latest applied batch (for rollback hint). */
  latestBatchCount: number;
  error?: string;
};

export type MigrationListStatus = "applied" | "pending" | "missing";

export type MigrationListEntry = {
  id: string;
  status: MigrationListStatus;
};

export function listMigrationsWithStatus(
  status: MigrationStatus,
): MigrationListEntry[] {
  const localSet = new Set(status.local);
  const appliedSet = new Set(status.applied);
  const ids = [...new Set([...status.local, ...status.applied])].sort();
  return ids.map((id) => {
    if (!localSet.has(id) && appliedSet.has(id)) {
      return { id, status: "missing" as const };
    }
    if (appliedSet.has(id)) {
      return { id, status: "applied" as const };
    }
    return { id, status: "pending" as const };
  });
}

export function formatManagerHint(status: MigrationStatus): string {
  if (status.error) {
    return "status unavailable";
  }
  if (
    status.local.length === 0 &&
    status.applied.length === 0
  ) {
    return "no migrations";
  }
  const parts = [
    `${status.applied.length} applied`,
    `${status.pending.length} pending`,
  ];
  if (status.missing.length > 0) {
    parts.push(`${status.missing.length} missing`);
  }
  return parts.join(", ");
}

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

export function latestBatchSize(
  applied: { batchNumber: number }[],
): number {
  if (applied.length === 0) return 0;
  const latest = Math.max(...applied.map((m) => m.batchNumber));
  return applied.filter((m) => m.batchNumber === latest).length;
}

export async function getMigrationStatus(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<MigrationStatus> {
  const format = resolveMigrationFormat(config, connection);
  const unsupported = assertFormatSupported(format);
  if (unsupported) {
    return {
      local: [],
      applied: [],
      pending: [],
      missing: [],
      latestBatchCount: 0,
      error: unsupported,
    };
  }

  const local = await listLocalMigrationIds(
    config.migrationsDir,
    connection.name,
    format,
    cwd,
  );

  const creds = getConnectionCredentials(connection.name);
  if (!creds.username || !creds.password) {
    return {
      local,
      applied: [],
      pending: local,
      missing: [],
      latestBatchCount: 0,
      error: "Missing credentials in .env",
    };
  }

  const credentials: ConnectionCredentials = {
    username: creds.username,
    password: creds.password,
  };

  const appliedResult = await fetchAppliedMigrations(connection, credentials);
  if (!appliedResult.ok) {
    return {
      local,
      applied: [],
      pending: local,
      missing: [],
      latestBatchCount: 0,
      error: appliedResult.error,
    };
  }

  const appliedIds = appliedResult.migrations.map((m) => m.id);
  const appliedSet = new Set(appliedIds);
  const localSet = new Set(local);
  const pending = local.filter((id) => !appliedSet.has(id));
  const missing = appliedIds.filter((id) => !localSet.has(id));

  return {
    local,
    applied: appliedIds,
    pending,
    missing,
    latestBatchCount: latestBatchSize(appliedResult.migrations),
  };
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

export function formatRollbackHint(status: MigrationStatus): string {
  if (status.error) {
    return "status unavailable";
  }
  if (status.latestBatchCount === 0) {
    return "nothing to roll back";
  }
  if (status.latestBatchCount === 1) {
    return "1 migration";
  }
  return `${status.latestBatchCount} migrations`;
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
