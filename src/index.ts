#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { configExists, loadConfig } from "./config.ts";
import { showConnectionsMenu } from "./menus/connections.ts";
import { runFirstTimeSetup } from "./setup.ts";
import { theme } from "./theme.ts";

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    p.log.warn(
      theme.muted(
        `Direct commands are not implemented yet (got: ${args.join(" ")}). Opening interactive menu.`,
      ),
    );
  }

  const hasConfig = await configExists();
  const config = hasConfig ? await loadConfig() : await runFirstTimeSetup();

  if (hasConfig) {
    p.intro(theme.title("Surreal Migrator"));
  }

  await showConnectionsMenu(config);
}

main().catch((err) => {
  p.log.error(theme.error(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
