import { deleteMigrationRecord } from "../../core/commands/migration/rollback.ts";
import type { Config } from "../../core/config.ts";
import { exitCodeForRunResult, formatRunResultLines } from "../print.ts";
import { resolveConnection } from "../resolve.ts";

export async function runForget(
  config: Config,
  id: string,
  connectionName: string | undefined,
  cwd = process.cwd(),
): Promise<number> {
  const resolved = resolveConnection(config, connectionName);
  if (!resolved.ok) {
    console.error(resolved.error);
    return 1;
  }
  const result = await deleteMigrationRecord(
    config,
    resolved.connection,
    id,
    cwd,
  );
  const lines = formatRunResultLines(
    "Deleted record",
    result,
    "No database record to delete.",
  );
  for (const line of lines) {
    if (result.ok) console.log(line);
    else console.error(line);
  }
  return exitCodeForRunResult(result);
}
