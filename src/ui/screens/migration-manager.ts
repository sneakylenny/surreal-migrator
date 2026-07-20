import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type SelectOption,
} from "@opentui/core";
import {
  migrateOne,
  migrateThrough,
} from "../../core/commands/migration/migrate.ts";
import {
  deleteMigrationRecord,
  rollbackAfter,
  rollbackOne,
} from "../../core/commands/migration/rollback.ts";
import type { RunResult } from "../../core/commands/migration/runner.ts";
import {
  getMigrationStatus,
  listMigrationsWithStatus,
  type MigrationListEntry,
  type MigrationStatus,
} from "../../core/commands/migration/status.ts";
import { findConnection, type Connection } from "../../core/config.ts";
import { createScreenShell } from "../layout.ts";
import type { ActionFlash, AppContext } from "../nav.ts";
import { onKeypress } from "../nav.ts";
import { colors, selectTheme } from "../theme.ts";

type OverlayMode =
  | "none"
  | "confirm"
  | "pending-menu"
  | "applied-menu"
  | "missing-menu";

type ListItem =
  | { kind: "loading" }
  | { kind: "entry"; entry: MigrationListEntry }
  | { kind: "back" };

const statusColor = {
  applied: colors.success,
  pending: colors.pink,
  missing: "#ef4444",
} as const;

const statusLabel = {
  applied: "applied",
  pending: "pending",
  missing: "missing source",
} as const;

function formatRunResult(
  label: string,
  result: RunResult,
  emptyMessage: string,
): ActionFlash {
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

function pendingThroughCount(status: MigrationStatus, id: string): number {
  return status.pending.filter((p) => p.localeCompare(id) <= 0).length;
}

function appliedAfterCount(status: MigrationStatus, id: string): number {
  return status.applied.filter((a) => a.localeCompare(id) > 0).length;
}

export function mountMigrationManagerScreen(
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

  const { root, content } = createScreenShell(
    renderer,
    ["connections", connection.name, "manager"],
    "migration-manager",
  );

  const actionStatus = new TextRenderable(renderer, {
    id: "manager-action-status",
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
    id: "manager-hints",
    content: "↑↓ navigate · Enter select · Esc back",
    fg: colors.muted,
    flexShrink: 0,
  });

  const listBox = new BoxRenderable(renderer, {
    id: "manager-list",
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "column",
    gap: 0,
  });

  const overlayBox = new BoxRenderable(renderer, {
    id: "manager-overlay",
    width: "100%",
    flexDirection: "column",
    gap: 1,
    flexShrink: 0,
  });

  let disposed = false;
  let overlayMode: OverlayMode = "none";
  let latestStatus: MigrationStatus | null = null;
  let busy = false;
  let activeEntry: MigrationListEntry | null = null;
  let items: ListItem[] = [{ kind: "loading" }];
  let selectedIndex = 0;

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
    activeEntry = null;
    paintList();
  }

  function goBack() {
    disposed = true;
    unsubscribe();
    ctx.showConnection(connection.name);
  }

  function remount(flashMsg?: ActionFlash) {
    disposed = true;
    unsubscribe();
    ctx.showMigrationManager(connection.name, flashMsg);
  }

  function paintList() {
    for (const child of [...listBox.getChildren()]) {
      child.destroyRecursively();
    }

    items.forEach((item, index) => {
      const selected = index === selectedIndex && overlayMode === "none";
      const row = new BoxRenderable(renderer, {
        id: `manager-row-${index}`,
        width: "100%",
        flexDirection: "row",
        flexShrink: 0,
        justifyContent: "space-between",
        alignItems: "center",
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
        backgroundColor: selected ? colors.purple : colors.obsidian,
      });

      if (item.kind === "loading") {
        row.add(
          new TextRenderable(renderer, {
            id: `manager-row-${index}-label`,
            content: "Loading…",
            fg: colors.muted,
            flexShrink: 0,
          }),
        );
      } else if (item.kind === "back") {
        row.add(
          new TextRenderable(renderer, {
            id: `manager-row-${index}-label`,
            content: "Back",
            fg: selected ? colors.moonlit : colors.muted,
            flexShrink: 0,
          }),
        );
        row.add(
          new TextRenderable(renderer, {
            id: `manager-row-${index}-hint`,
            content: "Return to connection",
            fg: selected ? "#CCCCCC" : colors.muted,
            flexShrink: 0,
          }),
        );
      } else {
        row.add(
          new TextRenderable(renderer, {
            id: `manager-row-${index}-id`,
            content: item.entry.id,
            fg: colors.moonlit,
            flexShrink: 1,
          }),
        );
        row.add(
          new TextRenderable(renderer, {
            id: `manager-row-${index}-status`,
            content: statusLabel[item.entry.status],
            fg: statusColor[item.entry.status],
            flexShrink: 0,
          }),
        );
      }

      listBox.add(row);
    });
  }

  function setItems(next: ListItem[]) {
    items = next;
    selectedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1));
    paintList();
  }

  function moveSelection(delta: number) {
    if (items.length === 0) return;
    selectedIndex = (selectedIndex + delta + items.length) % items.length;
    paintList();
  }

  function activateSelection() {
    const item = items[selectedIndex];
    if (!item) return;

    if (item.kind === "back") {
      goBack();
      return;
    }
    if (item.kind === "loading" || !latestStatus) {
      setActionStatus("Status still loading…", "muted");
      return;
    }

    if (item.entry.status === "pending") {
      showPendingMenu(item.entry);
    } else if (item.entry.status === "missing") {
      showMissingMenu(item.entry);
    } else {
      showAppliedMenu(item.entry);
    }
  }

  function showConfirm(
    message: string,
    onYes: () => void,
    onNo: () => void,
    yesDescription = "Continue",
  ) {
    clearOverlay();
    overlayMode = "confirm";
    paintList();
    setActionStatus(message, "muted");
    const confirm = new SelectRenderable(renderer, {
      id: "manager-confirm",
      width: "100%",
      height: 4,
      options: [
        { name: "Yes", description: yesDescription, value: true },
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

  function confirmDeleteRecord(
    entry: MigrationListEntry,
    reopen: () => void,
  ) {
    showConfirm(
      `Delete DB record for ${entry.id}? Only for stuck DB/codebase mismatches — does not run down.`,
      () => {
        void runDeleteRecord(entry.id);
      },
      reopen,
      "Remove record only (no down migration)",
    );
  }

  const deleteRecordOption = {
    name: "Delete migration record",
    description: "Remove DB history row only (no down) — mismatch cleanup",
    value: "delete-record",
  } as const;

  function showPendingMenu(entry: MigrationListEntry) {
    activeEntry = entry;
    clearOverlay();
    overlayMode = "pending-menu";
    paintList();
    setActionStatus(`Pending: ${entry.id}`, "muted");
    const menu = new SelectRenderable(renderer, {
      id: "manager-pending-menu",
      width: "100%",
      height: 8,
      options: [
        {
          name: "Run this migration",
          description: "Apply only this migration",
          value: "one",
        },
        {
          name: "Migrate to here",
          description: "Apply pending through this migration",
          value: "through",
        },
        deleteRecordOption,
        {
          name: "Back",
          description: "Return to list",
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
        if (option.value === "delete-record") {
          confirmDeleteRecord(entry, () => {
            showPendingMenu(entry);
          });
          return;
        }
        if (!latestStatus) return;
        if (option.value === "one") {
          showConfirm(
            `Run migration ${entry.id}?`,
            () => {
              void runMigrateOne(entry.id);
            },
            () => {
              showPendingMenu(entry);
            },
          );
          return;
        }
        const n = pendingThroughCount(latestStatus, entry.id);
        if (n === 0) {
          setActionStatus("Nothing to migrate through here.", "muted");
          return;
        }
        showConfirm(
          `Apply ${n} migration${n === 1 ? "" : "s"} through ${entry.id}?`,
          () => {
            void runMigrateThrough(entry.id);
          },
          () => {
            showPendingMenu(entry);
          },
        );
      },
    );
    overlayBox.add(menu);
    menu.focus();
  }

  function showAppliedMenu(entry: MigrationListEntry) {
    activeEntry = entry;
    clearOverlay();
    overlayMode = "applied-menu";
    paintList();
    setActionStatus(`Applied: ${entry.id}`, "muted");
    const menu = new SelectRenderable(renderer, {
      id: "manager-applied-menu",
      width: "100%",
      height: 8,
      options: [
        {
          name: "Rollback this migration",
          description: "Down only this migration",
          value: "one",
        },
        {
          name: "Roll back to here",
          description: "Down migrations after this one",
          value: "after",
        },
        deleteRecordOption,
        {
          name: "Back",
          description: "Return to list",
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
        if (option.value === "delete-record") {
          confirmDeleteRecord(entry, () => {
            showAppliedMenu(entry);
          });
          return;
        }
        if (!latestStatus) return;
        if (option.value === "one") {
          showConfirm(
            `Roll back migration ${entry.id}?`,
            () => {
              void runRollbackOne(entry.id);
            },
            () => {
              showAppliedMenu(entry);
            },
          );
          return;
        }
        const n = appliedAfterCount(latestStatus, entry.id);
        if (n === 0) {
          setActionStatus("Nothing to roll back after this migration.", "muted");
          return;
        }
        showConfirm(
          `Roll back ${n} migration${n === 1 ? "" : "s"} after ${entry.id}?`,
          () => {
            void runRollbackAfter(entry.id);
          },
          () => {
            showAppliedMenu(entry);
          },
        );
      },
    );
    overlayBox.add(menu);
    menu.focus();
  }

  function showMissingMenu(entry: MigrationListEntry) {
    activeEntry = entry;
    clearOverlay();
    overlayMode = "missing-menu";
    paintList();
    setActionStatus(
      `Missing source: ${entry.id} (DB record exists, local files gone)`,
      "error",
    );
    const menu = new SelectRenderable(renderer, {
      id: "manager-missing-menu",
      width: "100%",
      height: 4,
      options: [
        deleteRecordOption,
        {
          name: "Back",
          description: "Return to list",
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
        if (option.value === "delete-record") {
          confirmDeleteRecord(entry, () => {
            showMissingMenu(entry);
          });
        }
      },
    );
    overlayBox.add(menu);
    menu.focus();
  }

  async function runMigrateOne(id: string) {
    if (busy) return;
    busy = true;
    clearOverlay();
    setActionStatus("Migrating…", "muted");
    const result = await migrateOne(ctx.getConfig(), connection, id);
    remount(formatRunResult("Migrated", result, "Nothing to migrate."));
  }

  async function runMigrateThrough(id: string) {
    if (busy) return;
    busy = true;
    clearOverlay();
    setActionStatus("Migrating…", "muted");
    const result = await migrateThrough(ctx.getConfig(), connection, id);
    remount(formatRunResult("Migrated", result, "Nothing to migrate."));
  }

  async function runRollbackOne(id: string) {
    if (busy) return;
    busy = true;
    clearOverlay();
    setActionStatus("Rolling back…", "muted");
    const result = await rollbackOne(ctx.getConfig(), connection, id);
    remount(formatRunResult("Rolled back", result, "Nothing to roll back."));
  }

  async function runRollbackAfter(id: string) {
    if (busy) return;
    busy = true;
    clearOverlay();
    setActionStatus("Rolling back…", "muted");
    const result = await rollbackAfter(ctx.getConfig(), connection, id);
    remount(formatRunResult("Rolled back", result, "Nothing to roll back."));
  }

  async function runDeleteRecord(id: string) {
    if (busy) return;
    busy = true;
    clearOverlay();
    setActionStatus("Deleting migration record…", "muted");
    const result = await deleteMigrationRecord(
      ctx.getConfig(),
      connection,
      id,
    );
    remount(
      formatRunResult(
        "Deleted record",
        result,
        "No database record to delete.",
      ),
    );
  }

  const unsubscribe = onKeypress(renderer, (key) => {
    if (busy) return;

    if (key.name === "escape") {
      key.preventDefault();
    if (overlayMode === "confirm" && activeEntry) {
      if (activeEntry.status === "pending") {
        showPendingMenu(activeEntry);
      } else if (activeEntry.status === "missing") {
        showMissingMenu(activeEntry);
      } else {
        showAppliedMenu(activeEntry);
      }
      return;
    }
      if (overlayMode !== "none") {
        closeOverlay();
        setActionStatus("");
        return;
      }
      goBack();
      return;
    }

    if (overlayMode !== "none") return;

    if (key.name === "up" || key.name === "k") {
      key.preventDefault();
      moveSelection(-1);
      return;
    }
    if (key.name === "down" || key.name === "j") {
      key.preventDefault();
      moveSelection(1);
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      key.preventDefault();
      activateSelection();
    }
  });

  content.add(listBox);
  content.add(overlayBox);
  content.add(actionStatus);
  content.add(hints);
  renderer.root.add(root);
  paintList();

  void getMigrationStatus(config, connection).then((status) => {
    if (disposed) return;
    latestStatus = status;
    if (status.error) {
      setActionStatus(status.error, "error");
    } else if (status.local.length === 0 && status.applied.length === 0) {
      setActionStatus("No migrations yet.", "muted");
    } else if (status.missing.length > 0) {
      setActionStatus(
        `${status.missing.length} migration${status.missing.length === 1 ? "" : "s"} missing local source.`,
        "error",
      );
    }
    setItems([
      ...listMigrationsWithStatus(status).map(
        (entry): ListItem => ({ kind: "entry", entry }),
      ),
      { kind: "back" },
    ]);
  });
}
