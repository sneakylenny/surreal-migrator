import * as p from "@clack/prompts";
import {
  ensureMigrationsDir,
  saveConfig,
  type Config,
} from "./config.ts";
import { theme } from "./theme.ts";

export async function runFirstTimeSetup(): Promise<Config> {
  p.intro(theme.title("Surreal Migrator"));
  p.log.message(theme.muted("First-time setup — configure where migrations live."));

  const migrationsDir = await p.text({
    message: "Migrations directory",
    placeholder: "surreal",
    defaultValue: "surreal",
    initialValue: "surreal",
  });

  if (p.isCancel(migrationsDir)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const dir = migrationsDir.trim() || "surreal";
  await ensureMigrationsDir(dir);

  const config: Config = {
    migrationsDir: dir,
    defaultConnection: null,
    connections: [],
  };

  await saveConfig(config);
  p.log.success(theme.success(`Created surreal.config.json and ${dir}/`));

  return config;
}
