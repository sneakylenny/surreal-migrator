import {
  migrateOne,
  migrateThrough,
  migrateUp,
} from "../../core/commands/migration/migrate.ts";
import type { Config } from "../../core/config.ts";
import { exitCodeForRunResult, formatRunResultLines } from "../print.ts";
import { resolveConnection } from "../resolve.ts";

export async function runUp(
  config: Config,
  mode: "all" | "one" | "through",
  id: string | undefined,
  connectionName: string | undefined,
  cwd = process.cwd(),
): Promise<number> {
  const resolved = resolveConnection(config, connectionName);
  if (!resolved.ok) {
    console.error(resolved.error);
    return 1;
  }
  const connection = resolved.connection;

  const result =
    mode === "all"
      ? await migrateUp(config, connection, cwd)
      : mode === "one"
        ? await migrateOne(config, connection, id!, cwd)
        : await migrateThrough(config, connection, id!, cwd);

  const lines = formatRunResultLines(
    "Migrated",
    result,
    "No pending migrations.",
  );
  for (const line of lines) {
    if (result.ok) console.log(line);
    else console.error(line);
  }
  return exitCodeForRunResult(result);
}
