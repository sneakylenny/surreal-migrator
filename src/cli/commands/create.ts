import { createMigration } from "../../core/commands/migration/create.ts";
import type { Config } from "../../core/config.ts";
import { relativePaths } from "../print.ts";
import { resolveConnection } from "../resolve.ts";

export async function runCreate(
  config: Config,
  name: string,
  connectionName: string | undefined,
  cwd = process.cwd(),
): Promise<number> {
  const resolved = resolveConnection(config, connectionName);
  if (!resolved.ok) {
    console.error(resolved.error);
    return 1;
  }
  const result = await createMigration(
    config,
    resolved.connection,
    name,
    cwd,
  );
  if (!result.ok) {
    console.error(result.error);
    return 1;
  }
  const relative = relativePaths(result.files, cwd);
  console.log(`Created: ${relative.join(", ")}`);
  return 0;
}
