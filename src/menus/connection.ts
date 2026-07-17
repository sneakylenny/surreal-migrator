import * as p from "@clack/prompts";
import type { Config, Connection } from "../config.ts";
import { createMigration } from "../migrations/create.ts";
import {
  migrateUp,
  rollbackAll,
  rollbackBatch,
  type RunResult,
} from "../migrations/run.ts";
import {
  formatPendingHint,
  formatPendingOverview,
  formatRollbackHint,
  getMigrationStatus,
  type MigrationStatus,
} from "../migrations/status.ts";
import { theme } from "../theme.ts";

export type ConnectionMenuResult = {
  status: "back" | "quit";
  config: Config;
};

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

function countHint(count: number): string {
  if (count === 1) return "1 migration";
  return `${count} migrations`;
}

async function showRollbackMenu(
  config: Config,
  connection: Connection,
  status: MigrationStatus,
): Promise<void> {
  const choice = await p.select({
    message: "Rollback",
    options: [
      {
        value: "batch",
        label: "Batch",
        hint: countHint(status.latestBatchCount),
      },
      {
        value: "all",
        label: "All",
        hint: countHint(status.applied.length),
      },
      { value: "back", label: "Back" },
    ],
  });

  if (p.isCancel(choice) || choice === "back") {
    return;
  }

  if (choice === "batch") {
    if (!(await confirmAction("Rollback the latest migration batch?"))) {
      return;
    }

    const spin = p.spinner();
    spin.start("Rolling back batch…");
    const result = await rollbackBatch(config, connection);
    if (result.ok) {
      spin.stop(
        result.processed.length
          ? theme.success("Rollback complete")
          : theme.muted("Nothing to roll back"),
      );
    } else {
      spin.stop(theme.error("Rollback failed"));
    }
    reportRun("Reverted", result, "No applied migrations to roll back.");
    await Bun.sleep(1200);
    return;
  }

  if (!(await confirmAction("Rollback ALL applied migrations?"))) {
    return;
  }

  const spin = p.spinner();
  spin.start("Rolling back all migrations…");
  const result = await rollbackAll(config, connection);
  if (result.ok) {
    spin.stop(
      result.processed.length
        ? theme.success("Rollback all complete")
        : theme.muted("Nothing to roll back"),
    );
  } else {
    spin.stop(theme.error("Rollback all failed"));
  }
  reportRun("Reverted", result, "No applied migrations to roll back.");
  await Bun.sleep(1200);
}

export async function showConnectionMenu(
  config: Config,
  connection: Connection,
): Promise<ConnectionMenuResult> {
  let current = config;

  while (true) {
    const migrationStatus = await getMigrationStatus(current, connection);

    p.note(
      [
        `${theme.label("Endpoint")}  ${connection.endpoint}`,
        `${theme.label("Namespace")} ${connection.namespace}`,
        `${theme.label("Database")}  ${connection.database}`,
        `${theme.label("Table")}     ${connection.migrationTable}`,
        "",
        ...formatPendingOverview(migrationStatus).map((line) =>
          line.startsWith("  •") || line.includes("pending migration")
            ? theme.accent(line)
            : theme.muted(line),
        ),
      ].join("\n"),
      theme.title(connection.name),
    );

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "create", label: "Create migration" },
        {
          value: "migrate",
          label: "Migrate",
          hint: formatPendingHint(migrationStatus),
        },
        {
          value: "rollback",
          label: "Rollback",
          hint: formatRollbackHint(migrationStatus),
        },
        {
          value: "manager",
          label: "Migration manager",
          hint: "coming soon",
        },
        { value: "back", label: "Back" },
        { value: "quit", label: "Quit" },
      ],
    });

    if (p.isCancel(action)) {
      return { status: "back", config: current };
    }

    switch (action) {
      case "create":
        current = await createMigration(current, connection);
        break;
      case "migrate": {
        if (!(await confirmAction("Run pending migrations?"))) break;

        const spin = p.spinner();
        spin.start("Migrating…");
        const result = await migrateUp(current, connection);
        if (result.ok) {
          spin.stop(
            result.processed.length
              ? theme.success("Migrate complete")
              : theme.muted("Nothing to migrate"),
          );
        } else {
          spin.stop(theme.error("Migrate failed"));
        }
        reportRun("Applied", result, "No pending migrations.");
        await Bun.sleep(1200);
        break;
      }
      case "rollback":
        await showRollbackMenu(current, connection, migrationStatus);
        break;
      case "manager":
        p.log.warn(theme.muted("Not implemented yet — placeholder for later."));
        break;
      case "back":
        return { status: "back", config: current };
      case "quit":
        return { status: "quit", config: current };
    }
  }
}
