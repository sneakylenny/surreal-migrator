import {
  rollbackAfter,
  rollbackAll,
  rollbackBatch,
  rollbackOne,
} from "../../core/commands/migration/rollback.ts";
import type { Config } from "../../core/config.ts";
import { exitCodeForRunResult, formatRunResultLines } from "../print.ts";
import { resolveConnection } from "../resolve.ts";

export async function runDown(
  config: Config,
  mode: "batch" | "all" | "one" | "after",
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
    mode === "batch"
      ? await rollbackBatch(config, connection, cwd)
      : mode === "all"
        ? await rollbackAll(config, connection, cwd)
        : mode === "one"
          ? await rollbackOne(config, connection, id!, cwd)
          : await rollbackAfter(config, connection, id!, cwd);

  const lines = formatRunResultLines(
    "Rolled back",
    result,
    "Nothing to roll back.",
  );
  for (const line of lines) {
    if (result.ok) console.log(line);
    else console.error(line);
  }
  return exitCodeForRunResult(result);
}
