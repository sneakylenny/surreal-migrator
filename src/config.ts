import { mkdir } from "node:fs/promises";
import path from "node:path";

export const CONFIG_FILENAME = "surreal.config.json";

export type Connection = {
  name: string;
  endpoint: string;
  namespace: string;
  database: string;
  migrationTable: string;
};

export type MigrationFormat = "surql" | "ts";

export type Config = {
  migrationsDir: string;
  defaultConnection: string | null;
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
