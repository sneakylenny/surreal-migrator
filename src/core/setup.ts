import {
  configExists,
  ensureMigrationsDir,
  loadConfig,
  saveConfig,
  type Config,
} from "./config.ts";

const DEFAULT_MIGRATIONS_DIR = "surreal";

/**
 * Load existing config, or bootstrap a default project config when missing.
 * Non-interactive — suitable for CLI and TUI entry.
 */
export async function ensureConfig(cwd = process.cwd()): Promise<Config> {
  if (await configExists(cwd)) {
    return loadConfig(cwd);
  }

  await ensureMigrationsDir(DEFAULT_MIGRATIONS_DIR, cwd);

  const config: Config = {
    migrationsDir: DEFAULT_MIGRATIONS_DIR,
    defaultConnection: null,
    migrationFormat: null,
    connections: [],
  };

  await saveConfig(config, cwd);
  return config;
}
