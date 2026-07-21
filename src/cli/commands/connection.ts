import {
  createConnection,
  type CreateConnectionInput,
} from "../../core/commands/connection/create.ts";
import {
  updateConnection,
  type UpdateConnectionInput,
} from "../../core/commands/connection/update.ts";
import { verifyConnectionConnectivity } from "../../core/commands/connection/verify.ts";
import {
  findConnection,
  type Config,
  type MigrationFormat,
} from "../../core/config.ts";
import { getConnectionCredentials } from "../../core/env.ts";
import { assertFormatSupported } from "../../core/flags.ts";
import type { CliCommand } from "../parse.ts";
import { formatConnectionList } from "../print.ts";

export async function runConnectionList(config: Config): Promise<number> {
  for (const line of formatConnectionList(config)) {
    console.log(line);
  }
  return 0;
}

export async function runConnectionAdd(
  config: Config,
  cmd: Extract<CliCommand, { kind: "connection-add" }>,
  cwd = process.cwd(),
): Promise<number> {
  const formatError = assertFormatSupported(cmd.format ?? "surql");
  if (formatError) {
    console.error(formatError);
    return 1;
  }

  const input: CreateConnectionInput = {
    name: cmd.name,
    endpoint: cmd.endpoint,
    namespace: cmd.namespace,
    database: cmd.database,
    username: cmd.username,
    password: cmd.password,
    migrationTable: cmd.table,
    migrationFormat: cmd.format,
  };

  if (!cmd.skipVerify) {
    const verified = await verifyConnectionConnectivity(
      {
        endpoint: input.endpoint.trim() || "ws://localhost:8000",
        namespace: input.namespace.trim(),
        database: input.database.trim(),
        migrationTable: input.migrationTable.trim() || "migration",
      },
      {
        username: input.username.trim() || "root",
        password: input.password,
      },
    );
    if (!verified.ok) {
      console.error(verified.error);
      return 1;
    }
  }

  const result = await createConnection(config, input, {
    makeDefault: cmd.makeDefault,
    cwd,
  });
  if (!result.ok) {
    console.error(result.error);
    return 1;
  }
  console.log(`Created connection ${cmd.name}`);
  return 0;
}

export async function runConnectionUpdate(
  config: Config,
  cmd: Extract<CliCommand, { kind: "connection-update" }>,
  cwd = process.cwd(),
): Promise<number> {
  const existing = findConnection(config, cmd.name);
  if (!existing) {
    console.error(`Connection "${cmd.name}" not found`);
    return 1;
  }

  const envCreds = getConnectionCredentials(cmd.name);
  const username = cmd.username ?? envCreds.username;
  const password = cmd.password ?? envCreds.password;
  if (!username || !password) {
    console.error(
      "Missing credentials. Pass --username and --password, or set them in .env.",
    );
    return 1;
  }

  const format: MigrationFormat | null =
    cmd.format !== undefined ? cmd.format : existing.migrationFormat;
  const formatError = assertFormatSupported(format ?? "surql");
  if (formatError) {
    console.error(formatError);
    return 1;
  }

  const input: UpdateConnectionInput = {
    endpoint: cmd.endpoint ?? existing.endpoint,
    namespace: cmd.namespace ?? existing.namespace,
    database: cmd.database ?? existing.database,
    username,
    password,
    migrationTable: cmd.table ?? existing.migrationTable,
    migrationFormat: format,
  };

  if (!cmd.skipVerify) {
    const verified = await verifyConnectionConnectivity(
      {
        endpoint: input.endpoint.trim() || "ws://localhost:8000",
        namespace: input.namespace.trim(),
        database: input.database.trim(),
        migrationTable: input.migrationTable.trim() || "migration",
      },
      {
        username: input.username.trim() || "root",
        password: input.password,
      },
    );
    if (!verified.ok) {
      console.error(verified.error);
      return 1;
    }
  }

  const result = await updateConnection(config, cmd.name, input, {
    makeDefault: cmd.makeDefault,
    cwd,
  });
  if (!result.ok) {
    console.error(result.error);
    return 1;
  }
  console.log(`Updated connection ${cmd.name}`);
  return 0;
}
