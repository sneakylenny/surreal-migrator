import {
  findConnection,
  isValidTableName,
  saveConfig,
  type Config,
  type MigrationFormat,
} from "../../config.ts";
import {
  saveConnectionCredentials,
  type ConnectionCredentials,
} from "../../env.ts";
import {
  normalizeCreateConnectionInput,
  type CreateConnectionInput,
  type CreateConnectionResult,
} from "./create.ts";

/** Edit payload — connection name is fixed (identifies the row). */
export type UpdateConnectionInput = {
  endpoint: string;
  username: string;
  password: string;
  namespace: string;
  database: string;
  migrationTable: string;
  migrationFormat: MigrationFormat | null;
};

export function toCreateInput(
  name: string,
  input: UpdateConnectionInput,
): CreateConnectionInput {
  return { name, ...input };
}

/** Returns an error message, or null when valid. */
export function validateUpdateConnectionInput(
  config: Config,
  connectionName: string,
  input: UpdateConnectionInput,
): string | null {
  if (!findConnection(config, connectionName)) {
    return `Connection "${connectionName}" not found`;
  }

  const { connection } = normalizeCreateConnectionInput(
    toCreateInput(connectionName, input),
  );

  if (!connection.namespace) return "Namespace is required";
  if (!connection.database) return "Database is required";
  if (!isValidTableName(connection.migrationTable)) {
    return "Use a lowercase identifier (e.g. migration)";
  }

  return null;
}

/**
 * Update an existing connection (config + .env).
 * Does not verify connectivity — call verifyConnectionConnectivity first.
 * Name is not changed.
 */
export async function updateConnection(
  config: Config,
  connectionName: string,
  input: UpdateConnectionInput,
  options?: { makeDefault?: boolean; cwd?: string },
): Promise<CreateConnectionResult> {
  const validationError = validateUpdateConnectionInput(
    config,
    connectionName,
    input,
  );
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const cwd = options?.cwd ?? process.cwd();
  const { connection, credentials } = normalizeCreateConnectionInput(
    toCreateInput(connectionName, input),
  );

  try {
    await saveConnectionCredentials(connection.name, credentials, cwd);

    let nextConfig: Config = {
      ...config,
      connections: config.connections.map((c) =>
        c.name === connectionName ? connection : c,
      ),
    };

    if (options?.makeDefault === true) {
      nextConfig = { ...nextConfig, defaultConnection: connection.name };
    } else if (
      options?.makeDefault === false &&
      nextConfig.defaultConnection === connection.name
    ) {
      nextConfig = { ...nextConfig, defaultConnection: null };
    }

    await saveConfig(nextConfig, cwd);
    return { ok: true, config: nextConfig };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export type { ConnectionCredentials };
