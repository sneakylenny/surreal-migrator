import { createCliRenderer } from "@opentui/core";
import type { Config } from "../core/config.ts";
import { colors } from "./theme.ts";
import { mountConnectionsScreen } from "./screens/connections.ts";

export async function startApp(config: Config): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
  });

  renderer.setBackgroundColor(colors.obsidian);
  mountConnectionsScreen(renderer, config);
  renderer.start();
}
