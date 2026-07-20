import { createCliRenderer } from "@opentui/core";
import type { Config } from "../core/config.ts";
import { clearScreen, type AppContext } from "./nav.ts";
import { mountConnectionScreen } from "./screens/connection.ts";
import { mountConnectionsScreen } from "./screens/connections.ts";
import { mountCreateConnectionScreen } from "./screens/create-connection.ts";
import { mountEditConnectionScreen } from "./screens/edit-connection.ts";
import { mountMigrationManagerScreen } from "./screens/migration-manager.ts";
import { colors } from "./theme.ts";

export async function startApp(initialConfig: Config): Promise<void> {
  let config = initialConfig;

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
  });

  renderer.setBackgroundColor(colors.obsidian);

  const ctx: AppContext = {
    renderer,
    getConfig: () => config,
    setConfig: (next) => {
      config = next;
    },
    showConnections: () => {
      clearScreen(renderer);
      mountConnectionsScreen(ctx);
    },
    showCreateConnection: () => {
      clearScreen(renderer);
      mountCreateConnectionScreen(ctx);
    },
    showConnection: (name, flash) => {
      clearScreen(renderer);
      mountConnectionScreen(ctx, name, flash);
    },
    showEditConnection: (name) => {
      clearScreen(renderer);
      mountEditConnectionScreen(ctx, name);
    },
    showMigrationManager: (name, flash) => {
      clearScreen(renderer);
      mountMigrationManagerScreen(ctx, name, flash);
    },
  };

  ctx.showConnections();
  renderer.start();
}
