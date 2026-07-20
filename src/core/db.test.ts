import { describe, expect, test } from "bun:test";
import {
  ensureMigrationTableOn,
  fetchAppliedMigrationsOn,
  listDbTables,
  markMigrationApplied,
  markMigrationReverted,
  recordIdKey,
} from "./db.ts";
import { withMemDb } from "./test/mem-db.ts";

describe("recordIdKey", () => {
  test("normalizes surreal ids", () => {
    expect(recordIdKey({ id: "⟨abc-def⟩" })).toBe("abc-def");
    expect(recordIdKey("migration:hello")).toBe("hello");
  });
});

describe("migration table on mem://", () => {
  test("defines table and tracks applied rows", async () => {
    await withMemDb(async (db) => {
      await ensureMigrationTableOn(db, "migration");
      expect(await listDbTables(db)).toContain("migration");

      await markMigrationApplied(db, "migration", "20260101000001_demo", 1);
      const applied = await fetchAppliedMigrationsOn(db, "migration");
      expect(applied).toEqual([
        expect.objectContaining({
          id: "20260101000001_demo",
          batchNumber: 1,
        }),
      ]);

      await markMigrationReverted(db, "migration", "20260101000001_demo");
      expect(await fetchAppliedMigrationsOn(db, "migration")).toEqual([]);
    });
  });
});
