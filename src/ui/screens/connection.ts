import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type SelectOption,
} from "@opentui/core";
import { migrateUp } from "../../core/commands/migration/migrate.ts";
import {
  rollbackAll,
  rollbackBatch,
} from "../../core/commands/migration/rollback.ts";
import type { RunResult } from "../../core/commands/migration/runner.ts";
import {
  formatPendingHint,
  formatPendingOverview,
  formatRollbackHint,
  getMigrationStatus,
  type MigrationStatus,
} from "../../core/commands/migration/status.ts";
import {
  findConnection,
  resolveMigrationFormat,
  type Connection,
} from "../../core/config.ts";
import { createScreenShell } from "../layout.ts";
import type { AppContext, ActionFlash } from "../nav.ts";
import { onKeypress } from "../nav.ts";
import { colors, selectTheme } from "../theme.ts";

const CREATE = "create";
const MIGRATE = "migrate";
const ROLLBACK = "rollback";
const MANAGER = "manager";
const EDIT = "edit";
const BACK = "back";

type OverlayMode = "none" | "confirm" | "rollback-menu";

function formatLabel(format: "surql" | "ts"): string {
  return format === "ts" ? "TypeScript" : "Split SurQL";
}

function actionOptions(status: MigrationStatus | null): SelectOption[] {
  const migrateHint = status ? formatPendingHint(status) : "…";
  const rollbackHint = status ? formatRollbackHint(status) : "…";

  return [
    {
      name: "Create migration",
      description: "Add a new migration file",
      value: CREATE,
    },
    {
      name: "Migrate",
      description: migrateHint,
      value: MIGRATE,
    },
    {
      name: "Rollback",
      description: rollbackHint,
      value: ROLLBACK,
    },
    {
      name: "Migration manager",
      description: "Browse applied and pending migrations",
      value: MANAGER,
    },
    {
      name: "Edit connection",
      description: "Endpoint, credentials, format, default",
      value: EDIT,
    },
    {
      name: "Back",
      description: "Return to connections",
      value: BACK,
    },
  ];
}

function formatRunResult(
  label: string,
  result: RunResult,
  emptyMessage: string,
): { message: string; kind: "success" | "error" | "muted" } {
  if (!result.ok) {
    const stopped =
      result.processed.length > 0
        ? ` Stopped after: ${result.processed.join(", ")}`
        : "";
    return { message: `${result.error}${stopped}`, kind: "error" };
  }
  if (result.processed.length === 0) {
    return { message: emptyMessage, kind: "muted" };
  }
  return {
    message: `${label} (${result.processed.length}): ${result.processed.join(", ")}`,
    kind: "success",
  };
}

export function mountConnectionScreen(
  ctx: AppContext,
  connectionName: string,
  flash?: ActionFlash,
): void {
  const { renderer } = ctx;
  const config = ctx.getConfig();
  const found = findConnection(config, connectionName);

  if (!found) {
    ctx.showConnections();
    return;
  }

  const connection: Connection = found;
  const isDefault = config.defaultConnection === connection.name;
  const format = resolveMigrationFormat(config, connection);

  const { root, content } = createScreenShell(
    renderer,
    ["connections", connection.name],
    "connection",
  );

  const infoBox = new BoxRenderable(renderer, {
    id: "connection-info",
    width: "100%",
    flexShrink: 0,
    flexDirection: "row",
    border: true,
    borderStyle: "rounded",
    borderColor: colors.purple,
    backgroundColor: colors.lavender,
    title: isDefault ? `${connection.name} (default)` : connection.name,
    titleColor: colors.pink,
  });

  const detailsPane = new BoxRenderable(renderer, {
    id: "connection-details-pane",
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "column",
    padding: 1,
    gap: 0,
    backgroundColor: colors.lavender,
  });

  const details = new TextRenderable(renderer, {
    id: "connection-details",
    content: [
      `${connection.endpoint} · ${connection.namespace} / ${connection.database}`,
      `Table ${connection.migrationTable} · ${formatLabel(format)}`,
    ].join("\n"),
    fg: colors.moonlit,
    flexShrink: 0,
  });

  detailsPane.add(details);

  const statusPane = new BoxRenderable(renderer, {
    id: "connection-status-pane",
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "column",
    padding: 1,
    gap: 0,
    border: ["left"],
    borderStyle: "single",
    borderColor: colors.purple,
    backgroundColor: colors.lavender,
    title: "Migrations",
    titleColor: colors.pink,
  });

  const statusText = new TextRenderable(renderer, {
    id: "connection-status-overview",
    content: "Loading status…",
    fg: colors.muted,
    flexShrink: 0,
  });

  statusPane.add(statusText);
  infoBox.add(detailsPane);
  infoBox.add(statusPane);

  const actionStatus = new TextRenderable(renderer, {
    id: "connection-action-status",
    content: flash?.message ?? "",
    fg:
      flash?.kind === "error"
        ? "#ef4444"
        : flash?.kind === "success"
          ? colors.success
          : colors.muted,
    flexShrink: 0,
  });

  const hints = new TextRenderable(renderer, {
    id: "connection-hints",
    content: "Enter select · Esc back",
    fg: colors.muted,
    flexShrink: 0,
  });

  const select = new SelectRenderable(renderer, {
    id: "connection-actions",
    width: "100%",
    flexGrow: 1,
    options: actionOptions(null),
    showDescription: true,
    showScrollIndicator: true,
    wrapSelection: true,
    ...selectTheme,
  });

  const overlayBox = new BoxRenderable(renderer, {
    id: "connection-overlay",
    width: "100%",
    flexDirection: "column",
    gap: 1,
    flexShrink: 0,
  });

  let disposed = false;
  let overlayMode: OverlayMode = "none";
  let latestStatus: MigrationStatus | null = null;
  let busy = false;

  function setActionStatus(
    message: string,
    kind: "success" | "error" | "muted" = "muted",
  ) {
    actionStatus.content = message;
    actionStatus.fg =
      kind === "error"
        ? "#ef4444"
        : kind === "success"
          ? colors.success
          : colors.muted;
  }

  function clearOverlay() {
    for (const child of [...overlayBox.getChildren()]) {
      child.destroyRecursively();
    }
    overlayMode = "none";
  }

  function closeOverlay() {
    clearOverlay();
    select.focus();
  }

  function goBack() {
    disposed = true;
    unsubscribe();
    ctx.showConnections();
  }

  function remount(flashMsg?: ActionFlash) {
    disposed = true;
    unsubscribe();
    ctx.showConnection(connection.name, flashMsg);
  }

  function showConfirm(
    message: string,
    onYes: () => void,
    onNo: () => void,
  ) {
    clearOverlay();
    overlayMode = "confirm";
    setActionStatus(message, "muted");
    const confirm = new SelectRenderable(renderer, {
      id: "connection-confirm",
      width: "100%",
      height: 4,
      options: [
        { name: "Yes", description: "Continue", value: true },
        { name: "No", description: "Cancel", value: false },
      ],
      showDescription: true,
      ...selectTheme,
    });
    confirm.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_i: number, option: SelectOption) => {
        if (option.value) onYes();
        else onNo();
      },
    );
    overlayBox.add(confirm);
    confirm.focus();
  }

  function showRollbackMenu() {
    clearOverlay();
    overlayMode = "rollback-menu";
    setActionStatus("Choose rollback scope", "muted");
    const batchHint = latestStatus
      ? formatRollbackHint(latestStatus)
      : "latest batch";
    const menu = new SelectRenderable(renderer, {
      id: "connection-rollback-menu",
      width: "100%",
      height: 6,
      options: [
        {
          name: "Latest batch",
          description: batchHint,
          value: "batch",
        },
        {
          name: "All",
          description: "Roll back every applied migration",
          value: "all",
        },
        {
          name: "Back",
          description: "Return to actions",
          value: "back",
        },
      ],
      showDescription: true,
      ...selectTheme,
    });
    menu.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_i: number, option: SelectOption) => {
        if (option.value === "back") {
          closeOverlay();
          setActionStatus("");
          return;
        }
        const scope = option.value as "batch" | "all";
        const confirmMsg =
          scope === "batch"
            ? `Roll back the latest batch (${batchHint})?`
            : "Roll back ALL applied migrations?";
        showConfirm(
          confirmMsg,
          () => {
            void runRollback(scope);
          },
          () => {
            showRollbackMenu();
          },
        );
      },
    );
    overlayBox.add(menu);
    menu.focus();
  }

  async function runMigrate() {
    if (busy) return;
    busy = true;
    clearOverlay();
    setActionStatus("Migrating…", "muted");
    const result = await migrateUp(ctx.getConfig(), connection);
    remount(
      formatRunResult("Migrated", result, "No pending migrations."),
    );
  }

  async function runRollback(scope: "batch" | "all") {
    if (busy) return;
    busy = true;
    clearOverlay();
    setActionStatus("Rolling back…", "muted");
    const result =
      scope === "batch"
        ? await rollbackBatch(ctx.getConfig(), connection)
        : await rollbackAll(ctx.getConfig(), connection);
    remount(
      formatRunResult("Rolled back", result, "Nothing to roll back."),
    );
  }

  function startMigrate() {
    if (!latestStatus) {
      setActionStatus("Status still loading…", "muted");
      return;
    }
    if (latestStatus.pending.length === 0) {
      setActionStatus(
        latestStatus.error
          ? `Cannot migrate: ${latestStatus.error}`
          : "Already up to date.",
        latestStatus.error ? "error" : "muted",
      );
      return;
    }
    const n = latestStatus.pending.length;
    showConfirm(
      `Apply ${n} pending migration${n === 1 ? "" : "s"}?`,
      () => {
        void runMigrate();
      },
      () => {
        closeOverlay();
        setActionStatus("");
      },
    );
  }

  function startRollback() {
    if (!latestStatus) {
      setActionStatus("Status still loading…", "muted");
      return;
    }
    if (latestStatus.applied.length === 0) {
      setActionStatus(
        latestStatus.error
          ? `Cannot roll back: ${latestStatus.error}`
          : "Nothing to roll back.",
        latestStatus.error ? "error" : "muted",
      );
      return;
    }
    showRollbackMenu();
  }

  const unsubscribe = onKeypress(renderer, (key) => {
    if (key.name !== "escape") return;
    key.preventDefault();
    if (busy) return;
    if (overlayMode !== "none") {
      closeOverlay();
      setActionStatus("");
      return;
    }
    goBack();
  });

  select.on(
    SelectRenderableEvents.ITEM_SELECTED,
    (_index: number, option: SelectOption) => {
      if (overlayMode !== "none" || busy) return;

      if (option.value === BACK) {
        goBack();
        return;
      }

      if (option.value === EDIT) {
        disposed = true;
        unsubscribe();
        ctx.showEditConnection(connection.name);
        return;
      }

      if (option.value === MIGRATE) {
        startMigrate();
        return;
      }

      if (option.value === ROLLBACK) {
        startRollback();
        return;
      }

      setActionStatus("Coming soon", "muted");
    },
  );

  content.add(infoBox);
  content.add(select);
  content.add(overlayBox);
  content.add(actionStatus);
  content.add(hints);
  renderer.root.add(root);
  select.focus();

  void getMigrationStatus(config, connection).then((status) => {
    if (disposed) return;
    latestStatus = status;
    statusText.content = formatPendingOverview(status).join("\n");
    statusText.fg = status.error ? "#ef4444" : colors.muted;
    select.options = actionOptions(status);
  });
}
