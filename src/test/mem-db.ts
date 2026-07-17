/**
 * In-memory SurrealDB for tests via the Node/Bun embedded engine (`mem://`).
 * Not used by the interactive CLI (which connects over ws/http).
 */
import { createNodeEngines } from "@surrealdb/node";
import { Surreal, createRemoteEngines } from "surrealdb";
import { ensureMigrationTableOn } from "../db.ts";

/** Surreal client with remote + embedded Node engines (supports `mem://`). */
export function createTestSurrealClient(): Surreal {
  return new Surreal({
    engines: {
      ...createRemoteEngines(),
      ...createNodeEngines(),
    },
  });
}

export async function openMemDb(options?: {
  namespace?: string;
  database?: string;
}): Promise<Surreal> {
  const db = createTestSurrealClient();
  await db.connect("mem://", {
    namespace: options?.namespace ?? "app",
    database: options?.database ?? "main",
  });
  return db;
}

export async function withMemDb<T>(
  run: (db: Surreal) => Promise<T>,
  options?: { namespace?: string; database?: string; migrationTable?: string },
): Promise<T> {
  const db = await openMemDb(options);
  try {
    if (options?.migrationTable) {
      await ensureMigrationTableOn(db, options.migrationTable);
    }
    return await run(db);
  } finally {
    await db.close();
  }
}
