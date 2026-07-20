import path from "node:path";
import type { RunResult } from "../core/commands/migration/runner.ts";
import type { MigrationStatus } from "../core/commands/migration/status.ts";
import { listMigrationsWithStatus } from "../core/commands/migration/status.ts";
import type { Config } from "../core/config.ts";

export function relativePaths(files: string[], cwd = process.cwd()): string[] {
  return files.map((file) => path.relative(cwd, file));
}

export function formatRunResultLines(
  label: string,
  result: RunResult,
  emptyMessage: string,
): string[] {
  if (!result.ok) {
    const lines = [result.error];
    if (result.processed.length > 0) {
      lines.push(`Stopped after: ${result.processed.join(", ")}`);
    }
    return lines;
  }
  const skippedNote =
    result.skipped.length > 0
      ? ` (skipped missing source: ${result.skipped.join(", ")})`
      : "";
  if (result.processed.length === 0) {
    if (result.skipped.length > 0) {
      return [
        `Could not complete (missing source): ${result.skipped.join(", ")}`,
      ];
    }
    return [emptyMessage];
  }
  return [
    `${label} (${result.processed.length}): ${result.processed.join(", ")}${skippedNote}`,
  ];
}

export function formatStatusLines(status: MigrationStatus): string[] {
  if (status.error) {
    return [
      `Error: ${status.error}`,
      "",
      `Local: ${status.local.length}`,
      ...(status.local.length > 0
        ? status.local.map((id) => `  ${id}`)
        : []),
    ];
  }

  const entries = listMigrationsWithStatus(status);
  const lines = [
    `Applied: ${status.applied.length}  Pending: ${status.pending.length}  Missing source: ${status.missing.length}`,
  ];
  if (entries.length === 0) {
    lines.push("No migrations.");
    return lines;
  }
  lines.push("");
  for (const entry of entries) {
    const label =
      entry.status === "missing" ? "missing source" : entry.status;
    lines.push(`${entry.id}  ${label}`);
  }
  return lines;
}

export function formatConnectionList(config: Config): string[] {
  if (config.connections.length === 0) {
    return ["No connections configured."];
  }
  return config.connections.map((c) => {
    const mark = config.defaultConnection === c.name ? " (default)" : "";
    return `${c.name}${mark}`;
  });
}

export function exitCodeForRunResult(result: RunResult): number {
  return result.ok ? 0 : 1;
}
