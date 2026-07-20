import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type SelectOption,
} from "@opentui/core";
import { connectionsForMenu } from "../../core/config.ts";
import type { AppContext } from "../nav.ts";
import { colors, selectTheme } from "../theme.ts";

const ADD = "__add__";
const QUIT = "__quit__";

function connectionOptions(ctx: AppContext): SelectOption[] {
  const config = ctx.getConfig();
  const connections = connectionsForMenu(config).map((c) => ({
    name:
      config.defaultConnection === c.name ? `${c.name} (default)` : c.name,
    description: `${c.endpoint} · ${c.namespace} / ${c.database}`,
    value: c.name,
  }));

  return [
    ...connections,
    {
      name: "Add connection",
      description: "Create a new SurrealDB connection",
      value: ADD,
    },
    {
      name: "Quit",
      description: "Exit Surreal Migrator",
      value: QUIT,
    },
  ];
}

export function mountConnectionsScreen(ctx: AppContext): void {
  const { renderer } = ctx;
  const config = ctx.getConfig();

  const root = new BoxRenderable(renderer, {
    id: "connections-root",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 2,
    gap: 1,
    backgroundColor: colors.obsidian,
  });

  const title = new TextRenderable(renderer, {
    id: "connections-title",
    content: "Surreal Migrator",
    fg: colors.pink,
  });

  const subtitle = new TextRenderable(renderer, {
    id: "connections-subtitle",
    content: config.connections.length
      ? "Select a connection"
      : "No connections yet — add one to get started",
    fg: colors.muted,
  });

  const status = new TextRenderable(renderer, {
    id: "connections-status",
    content: "",
    fg: colors.muted,
  });

  const select = new SelectRenderable(renderer, {
    id: "connections-select",
    width: "100%",
    flexGrow: 1,
    options: connectionOptions(ctx),
    showDescription: true,
    showScrollIndicator: true,
    wrapSelection: true,
    ...selectTheme,
  });

  select.on(
    SelectRenderableEvents.ITEM_SELECTED,
    (_index: number, option: SelectOption) => {
      if (option.value === QUIT) {
        renderer.destroy();
        process.exit(0);
        return;
      }

      if (option.value === ADD) {
        ctx.showCreateConnection();
        return;
      }

      status.content = `Connection "${String(option.value)}" — coming soon`;
    },
  );

  root.add(title);
  root.add(subtitle);
  root.add(select);
  root.add(status);
  renderer.root.add(root);
  select.focus();
}
