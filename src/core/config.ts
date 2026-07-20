import { mkdir } from "node:fs/promises";
import path from "node:path";

export const CONFIG_FILENAME = "surreal.config.json";

export type MigrationFormat = "surql" | "ts";

export type Connection = {
  name: string;
  endpoint: string;
  namespace: string;
  database: string;
  migrationTable: string;
  /** When set, overrides the project-level migrationFormat for this connection. */
  migrationFormat: MigrationFormat | null;
};

export type Config = {
  migrationsDir: string;
  defaultConnection: string | null;
  /** Default format for connections that do not set their own. */
  migrationFormat: MigrationFormat | null;
  connections: Connection[];
};

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

export function configPath(cwd = process.cwd()): string {
  return path.join(cwd, CONFIG_FILENAME);
}

export async function configExists(cwd = process.cwd()): Promise<boolean> {
  return Bun.file(configPath(cwd)).exists();
}

function normalizeConnection(raw: Partial<Connection>): Connection {
  return {
    name: raw.name ?? "",
    endpoint: raw.endpoint ?? "ws://localhost:8000",
    namespace: raw.namespace ?? "",
    database: raw.database ?? "",
    migrationTable: raw.migrationTable ?? "migration",
    migrationFormat: raw.migrationFormat ?? null,
  };
}

export async function loadConfig(cwd = process.cwd()): Promise<Config> {
  const file = Bun.file(configPath(cwd));
  if (!(await file.exists())) {
    throw new Error(`${CONFIG_FILENAME} not found. Run the CLI once to set up.`);
  }
  const raw = (await file.json()) as Partial<Config>;
  return {
    migrationsDir: raw.migrationsDir ?? "surreal",
    defaultConnection: raw.defaultConnection ?? null,
    migrationFormat: raw.migrationFormat ?? null,
    connections: (raw.connections ?? []).map(normalizeConnection),
  };
}

export async function saveConfig(config: Config, cwd = process.cwd()): Promise<void> {
  await Bun.write(configPath(cwd), `${JSON.stringify(config, null, 2)}\n`);
}

export async function ensureMigrationsDir(
  migrationsDir: string,
  cwd = process.cwd(),
): Promise<string> {
  const absolute = path.resolve(cwd, migrationsDir);
  await mkdir(absolute, { recursive: true });
  return absolute;
}

export function isValidKebabCase(name: string): boolean {
  return KEBAB_CASE.test(name);
}

/** Surreal-safe table identifier: lowercase letter, then letters/digits/underscores. */
export function isValidTableName(name: string): boolean {
  return TABLE_NAME.test(name);
}

export function findConnection(config: Config, name: string): Connection | undefined {
  return config.connections.find((c) => c.name === name);
}

export function connectionExists(config: Config, name: string): boolean {
  return config.connections.some((c) => c.name === name);
}

/** Default connection first, then remaining connections in config order. */
export function connectionsForMenu(config: Config): Connection[] {
  const defaultName = config.defaultConnection;
  if (!defaultName) return [...config.connections];

  const preferred = config.connections.filter((c) => c.name === defaultName);
  const rest = config.connections.filter((c) => c.name !== defaultName);
  return [...preferred, ...rest];
}

/** Connection override, else project default, else SurQL. */
export function resolveMigrationFormat(
  config: Config,
  connection: Connection,
): MigrationFormat {
  return connection.migrationFormat ?? config.migrationFormat ?? "surql";
}

export function withConnectionMigrationFormat(
  config: Config,
  connectionName: string,
  format: MigrationFormat | null,
): Config {
  return {
    ...config,
    connections: config.connections.map((c) =>
      c.name === connectionName ? { ...c, migrationFormat: format } : c,
    ),
  };
}
