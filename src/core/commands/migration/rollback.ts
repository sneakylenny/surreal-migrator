import type { Config, Connection } from "../../config.ts";
import {
  forgetMigrationRecord,
  revertAllApplied,
  revertLatestBatch,
  revertMigration,
  revertMigrationsAfter,
  runWithConnection,
  type RunResult,
} from "./runner.ts";

export type { RunResult } from "./runner.ts";

export async function rollbackBatch(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, revertLatestBatch);
}

export async function rollbackAll(
  config: Config,
  connection: Connection,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, revertAllApplied);
}

export async function rollbackOne(
  config: Config,
  connection: Connection,
  id: string,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, (db, options) =>
    revertMigration(db, options, id),
  );
}

export async function rollbackAfter(
  config: Config,
  connection: Connection,
  id: string,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, (db, options) =>
    revertMigrationsAfter(db, options, id),
  );
}

/** Delete the DB migration row only — does not run down. */
export async function deleteMigrationRecord(
  config: Config,
  connection: Connection,
  id: string,
  cwd = process.cwd(),
): Promise<RunResult> {
  return runWithConnection(config, connection, cwd, (db, options) =>
    forgetMigrationRecord(db, options, id),
  );
}
