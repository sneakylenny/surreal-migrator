import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import {
  isValidKebabCase,
  resolveMigrationFormat,
  type Config,
  type Connection,
  type MigrationFormat,
} from "../config.ts";
import { assertFormatSupported } from "../features.ts";
import { theme } from "../theme.ts";
import templateDownSurql from "./templates/migration.down.surql" with {
  type: "text",
};
import templateTs from "./templates/migration.ts.txt" with { type: "text" };
import templateUpSurql from "./templates/migration.up.surql" with {
  type: "text",
};

function templateFor(
  format: MigrationFormat,
): { up: string; down?: string } {
  if (format === "surql") {
    return { up: templateUpSurql, down: templateDownSurql };
  }
  return { up: templateTs };
}

/** Local time as `YYYYMMDDHHmmss`. */
export function migrationTimestamp(date = new Date()): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${mo}${d}${h}${mi}${s}`;
}

export function migrationBaseName(timestamp: string, name: string): string {
  return `${timestamp}_${name}`;
}

export function connectionMigrationsDir(
  migrationsDir: string,
  connectionName: string,
  cwd = process.cwd(),
): string {
  return path.resolve(cwd, migrationsDir, connectionName);
}

export function migrationPaths(
  format: MigrationFormat,
  dir: string,
  baseName: string,
): string[] {
  if (format === "surql") {
    return [
      path.join(dir, `${baseName}.up.surql`),
      path.join(dir, `${baseName}.down.surql`),
    ];
  }
  return [path.join(dir, `${baseName}.ts`)];
}

export async function createMigration(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<Config> {
  const format = resolveMigrationFormat(config, connection);
  const unsupported = assertFormatSupported(format);
  if (unsupported) {
    p.log.error(theme.error(unsupported));
    return config;
  }

  const name = await p.text({
    message: "Migration name (kebab-case)",
    placeholder: "add-users",
    validate: (value) => {
      const trimmed = (value ?? "").trim();
      if (!trimmed) return "Name is required";
      if (!isValidKebabCase(trimmed)) {
        return "Use kebab-case (e.g. add-users)";
      }
    },
  });

  if (p.isCancel(name)) {
    p.log.message(theme.muted("Cancelled."));
    return config;
  }

  const baseName = migrationBaseName(migrationTimestamp(), name.trim());
  const dir = connectionMigrationsDir(
    config.migrationsDir,
    connection.name,
    cwd,
  );
  await mkdir(dir, { recursive: true });

  const files = migrationPaths(format, dir, baseName);
  const templates = templateFor(format);

  if (format === "surql") {
    await Bun.write(files[0]!, templates.up);
    await Bun.write(files[1]!, templates.down!);
  } else {
    await Bun.write(files[0]!, templates.up);
  }

  const relative = files.map((f) => path.relative(cwd, f));
  p.log.success(theme.success("Created migration:"));
  for (const rel of relative) {
    p.log.message(theme.accent(`  ${rel}`));
  }

  await Bun.sleep(1500);

  return config;
}
