import * as p from "@clack/prompts";
import type { Config, Connection } from "../config.ts";
import {
  migrateOne,
  rollbackAfter,
  rollbackOne,
  type RunResult,
} from "../migrations/run.ts";
import {
  formatManagerHint,
  getMigrationStatus,
  listMigrationsWithStatus,
  type MigrationListEntry,
  type MigrationStatus,
} from "../migrations/status.ts";
import { theme } from "../theme.ts";

function reportRun(
  label: string,
  result: RunResult,
  emptyMessage: string,
): void {
  if (!result.ok) {
    p.log.error(theme.error(result.error));
    if (result.processed.length > 0) {
      p.log.warn(
        theme.muted(`Stopped after: ${result.processed.join(", ")}`),
      );
    }
    return;
  }

  if (result.processed.length === 0) {
    p.log.info(theme.muted(emptyMessage));
    return;
  }

  p.log.success(
    theme.success(
      `${label} (${result.processed.length}): ${result.processed.join(", ")}`,
    ),
  );
}

async function confirmAction(message: string): Promise<boolean> {
  const confirmed = await p.confirm({
    message,
    initialValue: false,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.log.message(theme.muted("Cancelled."));
    return false;
  }
  return true;
}

function countAfter(
  entries: MigrationListEntry[],
  selectedId: string,
): number {
  return entries.filter(
    (e) => e.status === "applied" && e.id.localeCompare(selectedId) > 0,
  ).length;
}

async function handlePending(
  config: Config,
  connection: Connection,
  id: string,
): Promise<void> {
  if (!(await confirmAction(`Run migration ${id}?`))) {
    return;
  }

  const spin = p.spinner();
  spin.start("Applying migration…");
  const result = await migrateOne(config, connection, id);
  if (result.ok) {
    spin.stop(
      result.processed.length
        ? theme.success("Migration applied")
        : theme.muted("Nothing to apply"),
    );
  } else {
    spin.stop(theme.error("Apply failed"));
  }
  reportRun("Applied", result, "Migration already applied.");
  await Bun.sleep(1200);
}

async function handleApplied(
  config: Config,
  connection: Connection,
  id: string,
  entries: MigrationListEntry[],
): Promise<void> {
  const afterCount = countAfter(entries, id);
  const choice = await p.select({
    message: id,
    options: [
      {
        value: "toHere",
        label: "Rollback to here",
        hint:
          afterCount === 0
            ? "nothing after"
            : afterCount === 1
              ? "1 migration after"
              : `${afterCount} migrations after`,
      },
      {
        value: "this",
        label: "Rollback this migration",
      },
      { value: "back", label: "Back" },
    ],
  });

  if (p.isCancel(choice) || choice === "back") {
    return;
  }

  if (choice === "toHere") {
    const message =
      afterCount === 0
        ? `No migrations after ${id}. Continue anyway?`
        : afterCount === 1
          ? `Rollback 1 migration after ${id}?`
          : `Rollback ${afterCount} migrations after ${id}?`;
    if (!(await confirmAction(message))) {
      return;
    }

    const spin = p.spinner();
    spin.start("Rolling back…");
    const result = await rollbackAfter(config, connection, id);
    if (result.ok) {
      spin.stop(
        result.processed.length
          ? theme.success("Rollback to here complete")
          : theme.muted("Nothing to roll back"),
      );
    } else {
      spin.stop(theme.error("Rollback failed"));
    }
    reportRun("Reverted", result, "No migrations after the selection.");
    await Bun.sleep(1200);
    return;
  }

  if (!(await confirmAction(`Rollback migration ${id}?`))) {
    return;
  }

  const spin = p.spinner();
  spin.start("Rolling back…");
  const result = await rollbackOne(config, connection, id);
  if (result.ok) {
    spin.stop(
      result.processed.length
        ? theme.success("Rollback complete")
        : theme.muted("Nothing to roll back"),
    );
  } else {
    spin.stop(theme.error("Rollback failed"));
  }
  reportRun("Reverted", result, "Migration was not applied.");
  await Bun.sleep(1200);
}

export async function showMigrationManager(
  config: Config,
  connection: Connection,
): Promise<void> {
  while (true) {
    const status: MigrationStatus = await getMigrationStatus(
      config,
      connection,
    );

    if (status.error) {
      p.log.warn(theme.muted(status.error));
    }

    const entries = listMigrationsWithStatus(status);
    if (entries.length === 0) {
      p.log.info(theme.muted("No local migrations found."));
      return;
    }

    const selected = await p.select({
      message: `Migrations (${formatManagerHint(status)})`,
      options: [
        ...entries.map((entry) => ({
          value: entry.id,
          label:
            entry.status === "applied"
              ? theme.accent(entry.id)
              : theme.muted(entry.id),
          hint:
            entry.status === "applied"
              ? theme.accent("applied")
              : theme.muted("pending"),
        })),
        { value: "back", label: "Back" },
      ],
    });

    if (p.isCancel(selected) || selected === "back") {
      return;
    }

    const entry = entries.find((e) => e.id === selected);
    if (!entry) {
      continue;
    }

    if (entry.status === "pending") {
      await handlePending(config, connection, entry.id);
    } else {
      await handleApplied(config, connection, entry.id, entries);
    }
  }
}
