import type { CliRenderer, Renderable } from "@opentui/core";
import type { Config } from "../core/config.ts";

export type ActionFlash = {
  message: string;
  kind: "success" | "error" | "muted";
};

export type AppContext = {
  renderer: CliRenderer;
  getConfig: () => Config;
  setConfig: (config: Config) => void;
  showConnections: () => void;
  showCreateConnection: () => void;
  showConnection: (name: string, flash?: ActionFlash) => void;
  showEditConnection: (name: string) => void;
};

/** Destroy and detach all children of the renderer root. */
export function clearScreen(renderer: CliRenderer): void {
  for (const child of [...renderer.root.getChildren()]) {
    child.destroyRecursively();
  }
}

export type KeypressHandler = (key: {
  name: string;
  shift: boolean;
  preventDefault: () => void;
}) => void;

/** Register a keypress listener; returns an unsubscribe function. */
export function onKeypress(
  renderer: CliRenderer,
  handler: KeypressHandler,
): () => void {
  const listener = (key: {
    name: string;
    shift: boolean;
    preventDefault: () => void;
  }) => handler(key);
  renderer.keyInput.on("keypress", listener);
  return () => {
    renderer.keyInput.off("keypress", listener);
  };
}

export function focusablesOf(nodes: Renderable[]): Renderable[] {
  return nodes.filter((n) => n.focusable);
}
