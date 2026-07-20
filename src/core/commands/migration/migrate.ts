import type { Config, Connection } from "../../config.ts";
import {
  applyMigration,
  applyPendingMigrations,
  runWithConnection,
  type RunResult,
} from "./runner.ts";

export type { RunResult } from "./runner.ts";

export async function migrateUp(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, applyPendingMigrations);
}

export async function migrateOne(
  config: Config,
  connection: Connection,
  id: string,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, (db, options) =>
    applyMigration(db, options, id),
  );
}
