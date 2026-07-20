import {
  ASCIIFontRenderable,
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type SelectOption,
} from "@opentui/core";
import { connectionsForMenu } from "../../core/config.ts";
import type { AppContext } from "../nav.ts";
import { onKeypress } from "../nav.ts";
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

function quit(ctx: AppContext): void {
  ctx.renderer.destroy();
  process.exit(0);
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

  const title = new ASCIIFontRenderable(renderer, {
    id: "connections-title",
    text: "Surreal Migrator",
    font: "tiny",
    color: colors.pink,
    backgroundColor: colors.obsidian,
    selectable: false,
  });

  const subtitle = new TextRenderable(renderer, {
    id: "connections-subtitle",
    content: config.connections.length
      ? "Select a connection"
      : "No connections yet — add one to get started",
    fg: colors.muted,
    flexShrink: 0,
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

  const unsubscribe = onKeypress(renderer, (key) => {
    if (key.name === "escape") {
      key.preventDefault();
      unsubscribe();
      quit(ctx);
    }
  });

  select.on(
    SelectRenderableEvents.ITEM_SELECTED,
    (_index: number, option: SelectOption) => {
      if (option.value === QUIT) {
        unsubscribe();
        quit(ctx);
        return;
      }

      if (option.value === ADD) {
        unsubscribe();
        ctx.showCreateConnection();
        return;
      }

      unsubscribe();
      ctx.showConnection(String(option.value));
    },
  );

  root.add(title);
  root.add(subtitle);
  root.add(select);
  renderer.root.add(root);
  select.focus();
}
