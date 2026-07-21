import { createCliRenderer } from "@opentui/core";
import type { Config } from "../core/config.ts";
import { clearScreen, type AppContext } from "./nav.ts";
import { mountConnectionScreen } from "./screens/connection.ts";
import { mountConnectionsScreen } from "./screens/connections.ts";
import { mountCreateConnectionScreen } from "./screens/create-connection.ts";
import { mountEditConnectionScreen } from "./screens/edit-connection.ts";
import { mountMigrationManagerScreen } from "./screens/migration-manager.ts";
import { mountSessionLogScreen } from "./screens/session-log.ts";
import { createSessionLog, printSessionSummary } from "./session-log.ts";
import { colors } from "./theme.ts";

export async function startApp(initialConfig: Config): Promise<void> {
  let config = initialConfig;
  const sessionLog = createSessionLog();
  let exiting = false;

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
  });

  renderer.setBackgroundColor(colors.obsidian);

  const exitApp = (code = 0) => {
    if (exiting) return;
    exiting = true;
    try {
      renderer.destroy();
    } catch {
      // ignore destroy errors on the way out
    }
    printSessionSummary(sessionLog);
    process.exit(code);
  };

  const ctx: AppContext = {
    renderer,
    getConfig: () => config,
    setConfig: (next) => {
      config = next;
    },
    sessionLog,
    exitApp,
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
    showSessionLog: () => {
      clearScreen(renderer);
      mountSessionLogScreen(ctx);
    },
  };

  const onSignal = () => exitApp(0);
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  ctx.showConnections();
  renderer.start();
}
