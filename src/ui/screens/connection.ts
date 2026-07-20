import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type SelectOption,
} from "@opentui/core";
import {
  findConnection,
  resolveMigrationFormat,
} from "../../core/config.ts";
import {
  formatPendingHint,
  formatPendingOverview,
  formatRollbackHint,
  getMigrationStatus,
  type MigrationStatus,
} from "../../core/commands/migration/status.ts";
import { createScreenShell } from "../layout.ts";
import type { AppContext } from "../nav.ts";
import { onKeypress } from "../nav.ts";
import { colors, selectTheme } from "../theme.ts";

const CREATE = "create";
const MIGRATE = "migrate";
const ROLLBACK = "rollback";
const MANAGER = "manager";
const EDIT = "edit";
const BACK = "back";

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

export function mountConnectionScreen(
  ctx: AppContext,
  connectionName: string,
): void {
  const { renderer } = ctx;
  const config = ctx.getConfig();
  const connection = findConnection(config, connectionName);

  if (!connection) {
    ctx.showConnections();
    return;
  }

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
    content: "",
    fg: colors.muted,
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

  let disposed = false;

  function goBack() {
    disposed = true;
    unsubscribe();
    ctx.showConnections();
  }

  const unsubscribe = onKeypress(renderer, (key) => {
    if (key.name === "escape") {
      key.preventDefault();
      goBack();
    }
  });

  select.on(
    SelectRenderableEvents.ITEM_SELECTED,
    (_index: number, option: SelectOption) => {
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

      actionStatus.content = "Coming soon";
      actionStatus.fg = colors.muted;
    },
  );

  content.add(infoBox);
  content.add(select);
  content.add(actionStatus);
  content.add(hints);
  renderer.root.add(root);
  select.focus();

  void getMigrationStatus(config, connection).then((status) => {
    if (disposed) return;
    statusText.content = formatPendingOverview(status).join("\n");
    statusText.fg = status.error ? "#ef4444" : colors.muted;
    select.options = actionOptions(status);
  });
}
