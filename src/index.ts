#!/usr/bin/env bun
import { runCli } from "./cli/run.ts";
import { ensureConfig } from "./core/setup.ts";
import { startApp } from "./ui/app.ts";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    const config = await ensureConfig();
    await startApp(config);
    return;
  }

  process.exit(await runCli(args));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
