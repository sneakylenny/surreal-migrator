import {
  findConnection,
  type Config,
  type Connection,
} from "../core/config.ts";

export type ResolveConnectionResult =
  | { ok: true; connection: Connection }
  | { ok: false; error: string };

/** Resolve `-c` / `--connection`, else `defaultConnection`. */
export function resolveConnection(
  config: Config,
  connectionName?: string,
): ResolveConnectionResult {
  const name = connectionName?.trim() || config.defaultConnection;
  if (!name) {
    return {
      ok: false,
      error:
        "No connection specified. Pass -c <name> or set defaultConnection in surreal.config.json.",
    };
  }
  const connection = findConnection(config, name);
  if (!connection) {
    return { ok: false, error: `Connection "${name}" not found` };
  }
  return { ok: true, connection };
}
