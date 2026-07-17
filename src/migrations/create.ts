import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import {
  findConnection,
  isValidKebabCase,
  resolveMigrationFormat,
  saveConfig,
  withConnectionMigrationFormat,
  type Config,
  type Connection,
  type MigrationFormat,
} from "../config.ts";
import { theme } from "../theme.ts";

const TEMPLATES_DIR = path.join(import.meta.dir, "templates");

async function readTemplate(filename: string): Promise<string> {
  return Bun.file(path.join(TEMPLATES_DIR, filename)).text();
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
  let next = config;
  let current = connection;

  if (!resolveMigrationFormat(next, current)) {
    const format = await p.select({
      message: "Choose a migration format (saved for this connection)",
      options: [
        {
          value: "surql" as const,
          label: "Split SurQL",
          hint: ".up.surql and .down.surql",
        },
        {
          value: "ts" as const,
          label: "TypeScript",
          hint: "single file with up/down functions",
        },
      ],
    });

    if (p.isCancel(format)) {
      p.log.message(theme.muted("Cancelled."));
      return config;
    }

    next = withConnectionMigrationFormat(next, current.name, format);
    current = findConnection(next, current.name)!;
    await saveConfig(next, cwd);
    p.log.success(
      theme.success(
        `Using ${format === "surql" ? "split SurQL" : "TypeScript"} migrations for "${current.name}"`,
      ),
    );
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
    return next;
  }

  const format = resolveMigrationFormat(next, current)!;
  const baseName = migrationBaseName(migrationTimestamp(), name.trim());
  const dir = connectionMigrationsDir(next.migrationsDir, current.name, cwd);
  await mkdir(dir, { recursive: true });

  const files = migrationPaths(format, dir, baseName);

  if (format === "surql") {
    await Bun.write(files[0]!, await readTemplate("migration.up.surql"));
    await Bun.write(files[1]!, await readTemplate("migration.down.surql"));
  } else {
    await Bun.write(files[0]!, await readTemplate("migration.ts"));
  }

  const relative = files.map((f) => path.relative(cwd, f));
  p.log.success(theme.success("Created migration:"));
  for (const rel of relative) {
    p.log.message(theme.accent(`  ${rel}`));
  }

  await Bun.sleep(1500);

  return next;
}
