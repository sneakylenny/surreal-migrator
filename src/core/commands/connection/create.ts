import {
  connectionExists,
  isValidKebabCase,
  isValidTableName,
  saveConfig,
  type Config,
  type Connection,
  type MigrationFormat,
} from "../../config.ts";
import {
  saveConnectionCredentials,
  type ConnectionCredentials,
} from "../../env.ts";

export type CreateConnectionInput = {
  name: string;
  endpoint: string;
  username: string;
  password: string;
  namespace: string;
  database: string;
  migrationTable: string;
  /** Already persisted shape: null = SurQL, "ts" when TS chosen */
  migrationFormat: MigrationFormat | null;
};

export type NormalizedCreateConnection = {
  connection: Connection;
  credentials: ConnectionCredentials;
};

export type CreateConnectionResult =
  | { ok: true; config: Config }
  | { ok: false; error: string };

/** Trim and apply defaults; does not check uniqueness or format rules. */
export function normalizeCreateConnectionInput(
  input: CreateConnectionInput,
): NormalizedCreateConnection {
  return {
    connection: {
      name: input.name.trim(),
      endpoint: input.endpoint.trim() || "ws://localhost:8000",
      namespace: input.namespace.trim(),
      database: input.database.trim(),
      migrationTable: input.migrationTable.trim() || "migration",
      migrationFormat: input.migrationFormat,
    },
    credentials: {
      username: input.username.trim() || "root",
      password: input.password,
    },
  };
}

/** Returns an error message, or null when valid. */
export function validateCreateConnectionInput(
  config: Config,
  input: CreateConnectionInput,
): string | null {
  const { connection } = normalizeCreateConnectionInput(input);

  if (!connection.name) return "Name is required";
  if (!isValidKebabCase(connection.name)) {
    return "Use kebab-case (e.g. my-connection)";
  }
  if (connectionExists(config, connection.name)) {
    return `Connection "${connection.name}" already exists`;
  }
  if (!connection.namespace) return "Namespace is required";
  if (!connection.database) return "Database is required";
  if (!isValidTableName(connection.migrationTable)) {
    return "Use a lowercase identifier (e.g. migration)";
  }

  return null;
}

/**
 * Validate and persist a new connection (config + .env).
 * Does not verify connectivity — call verifyConnectionConnectivity first.
 */
export async function createConnection(
  config: Config,
  input: CreateConnectionInput,
  options?: { makeDefault?: boolean; cwd?: string },
): Promise<CreateConnectionResult> {
  const validationError = validateCreateConnectionInput(config, input);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const cwd = options?.cwd ?? process.cwd();
  const { connection, credentials } = normalizeCreateConnectionInput(input);

  try {
    await saveConnectionCredentials(connection.name, credentials, cwd);

    let nextConfig: Config = {
      ...config,
      connections: [...config.connections, connection],
    };

    if (options?.makeDefault) {
      nextConfig = { ...nextConfig, defaultConnection: connection.name };
    }

    await saveConfig(nextConfig, cwd);
    return { ok: true, config: nextConfig };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
