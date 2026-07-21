import { getMigrationStatus } from "../../core/commands/migration/status.ts";
import type { Config } from "../../core/config.ts";
import { formatStatusLines } from "../print.ts";
import { resolveConnection } from "../resolve.ts";

export async function runStatus(
  config: Config,
  connectionName: string | undefined,
  cwd = process.cwd(),
): Promise<number> {
  const resolved = resolveConnection(config, connectionName);
  if (!resolved.ok) {
    console.error(resolved.error);
    return 1;
  }
  const status = await getMigrationStatus(config, resolved.connection, cwd);
  for (const line of formatStatusLines(status)) {
    console.log(line);
  }
  return status.error ? 1 : 0;
}
