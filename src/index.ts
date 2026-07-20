#!/usr/bin/env bun
import { ensureConfig } from "./core/setup.ts";
import { startApp } from "./ui/app.ts";

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    console.error(
      `Direct commands are not implemented yet (got: ${args.join(" ")}). Opening interactive menu.`,
    );
  }

  const config = await ensureConfig();
  await startApp(config);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
