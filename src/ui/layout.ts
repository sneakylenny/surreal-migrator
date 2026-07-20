import {
  ASCIIFontRenderable,
  BoxRenderable,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core";
import { colors } from "./theme.ts";

/** Display name for the TUI — change here to update all screens. */
export const APP_TITLE = "Surreal Migrator";

/** Route segments shown under the app title, e.g. `connections / local`. */
export type AppPath = readonly string[];

export function formatAppPath(path: AppPath): string {
  return path.join(" / ");
}

export function createAppTitle(
  renderer: CliRenderer,
  id = "app-title",
): ASCIIFontRenderable {
  return new ASCIIFontRenderable(renderer, {
    id,
    text: APP_TITLE,
    font: "tiny",
    color: colors.pink,
    backgroundColor: colors.obsidian,
    selectable: false,
  });
}

export type ScreenShell = {
  root: BoxRenderable;
  /** Main area below title + path — screens mount their UI here. */
  content: BoxRenderable;
};

/**
 * Shared chrome for every screen: app title, breadcrumb path, content slot.
 */
export function createScreenShell(
  renderer: CliRenderer,
  path: AppPath,
  id = "screen",
): ScreenShell {
  const root = new BoxRenderable(renderer, {
    id: `${id}-root`,
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 2,
    gap: 1,
    backgroundColor: colors.obsidian,
  });

  root.add(createAppTitle(renderer, `${id}-title`));

  root.add(
    new TextRenderable(renderer, {
      id: `${id}-path`,
      content: formatAppPath(path),
      fg: colors.muted,
      flexShrink: 0,
    }),
  );

  const content = new BoxRenderable(renderer, {
    id: `${id}-content`,
    width: "100%",
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: "column",
    gap: 1,
    backgroundColor: colors.obsidian,
  });

  root.add(content);
  return { root, content };
}
