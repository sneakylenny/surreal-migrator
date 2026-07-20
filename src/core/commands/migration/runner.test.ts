import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fetchAppliedMigrationsOn, listDbTables } from "../../db.ts";
import { withMemDb } from "../../test/mem-db.ts";
import {
  applyMigration,
  applyPendingMigrations,
  applyPendingThrough,
  nextBatchNumber,
  revertAllApplied,
  revertLatestBatch,
  revertMigration,
  revertMigrationsAfter,
  sortForRollback,
  type MigrationRunOptions,
} from "./runner.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function createFixture(
  format: "surql" | "ts",
): Promise<MigrationRunOptions & { cwd: string }> {
  const cwd = await mkdtemp(path.join(tmpdir(), "sm-mig-"));
  tempDirs.push(cwd);
  const connectionName = "local";
  const migrationsDir = "surreal";
  const dir = path.join(cwd, migrationsDir, connectionName);
  await mkdir(dir, { recursive: true });

  if (format === "surql") {
    await writeFile(
      path.join(dir, "20260101000001_create-widget.up.surql"),
      "DEFINE TABLE widget SCHEMALESS;\n",
    );
    await writeFile(
      path.join(dir, "20260101000001_create-widget.down.surql"),
      "REMOVE TABLE IF EXISTS widget;\n",
    );
    await writeFile(
      path.join(dir, "20260101000002_create-item.up.surql"),
      "DEFINE TABLE item SCHEMALESS;\n",
    );
    await writeFile(
      path.join(dir, "20260101000002_create-item.down.surql"),
      "REMOVE TABLE IF EXISTS item;\n",
    );
  } else {
    await writeFile(
      path.join(dir, "20260101000001_create-widget.ts"),
      `import type { Surreal } from "surrealdb";
export async function up(db: Surreal) {
  await db.query("DEFINE TABLE widget SCHEMALESS;").collect();
}
export async function down(db: Surreal) {
  await db.query("REMOVE TABLE IF EXISTS widget;").collect();
}
`,
    );
    await writeFile(
      path.join(dir, "20260101000002_create-item.ts"),
      `import type { Surreal } from "surrealdb";
export async function up(db: Surreal) {
  await db.query("DEFINE TABLE item SCHEMALESS;").collect();
}
export async function down(db: Surreal) {
  await db.query("REMOVE TABLE IF EXISTS item;").collect();
}
`,
    );
  }

  return {
    cwd,
    connectionName,
    migrationsDir,
    migrationTable: "migration",
    format,
  };
}

describe("nextBatchNumber / sortForRollback", () => {
  test("starts at 1 and increments", () => {
    expect(nextBatchNumber([])).toBe(1);
    expect(
      nextBatchNumber([
        { id: "a", batchNumber: 2, appliedAt: null },
        { id: "b", batchNumber: 5, appliedAt: null },
      ]),
    ).toBe(6);
  });

  test("sorts by batch desc then id desc", () => {
    const rows = [
      { id: "a", batchNumber: 1, appliedAt: null },
      { id: "c", batchNumber: 2, appliedAt: null },
      { id: "b", batchNumber: 2, appliedAt: null },
    ];
    expect([...rows].sort(sortForRollback).map((r) => r.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});

describe("migrate + rollback (surql) with embedded mem://", () => {
  test("applies pending migrations and creates tables", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        const processed = await applyPendingMigrations(db, fixture);
        expect(processed).toEqual([
          "20260101000001_create-widget",
          "20260101000002_create-item",
        ]);

        const applied = await fetchAppliedMigrationsOn(db, "migration");
        expect(applied.map((m) => m.id)).toEqual(processed);
        expect(applied.every((m) => m.batchNumber === 1)).toBe(true);

        const tables = await listDbTables(db);
        expect(tables).toContain("widget");
        expect(tables).toContain("item");
        expect(tables).toContain("migration");
      },
      { migrationTable: "migration" },
    );
  });

  test("rollback batch removes latest batch only", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        await applyPendingMigrations(db, fixture);

        await writeFile(
          path.join(
            fixture.cwd,
            fixture.migrationsDir,
            fixture.connectionName,
            "20260101000003_create-tag.up.surql",
          ),
          "DEFINE TABLE tag SCHEMALESS;\n",
        );
        await writeFile(
          path.join(
            fixture.cwd,
            fixture.migrationsDir,
            fixture.connectionName,
            "20260101000003_create-tag.down.surql",
          ),
          "REMOVE TABLE IF EXISTS tag;\n",
        );

        const second = await applyPendingMigrations(db, fixture);
        expect(second).toEqual(["20260101000003_create-tag"]);

        const reverted = await revertLatestBatch(db, fixture);
        expect(reverted).toEqual(["20260101000003_create-tag"]);

        const applied = await fetchAppliedMigrationsOn(db, "migration");
        expect(applied.map((m) => m.id)).toEqual([
          "20260101000001_create-widget",
          "20260101000002_create-item",
        ]);

        const tables = await listDbTables(db);
        expect(tables).toContain("widget");
        expect(tables).toContain("item");
        expect(tables).not.toContain("tag");
      },
      { migrationTable: "migration" },
    );
  });

  test("rollback all removes every applied migration", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        await applyPendingMigrations(db, fixture);
        const reverted = await revertAllApplied(db, fixture);
        expect(reverted).toEqual([
          "20260101000002_create-item",
          "20260101000001_create-widget",
        ]);

        const applied = await fetchAppliedMigrationsOn(db, "migration");
        expect(applied).toEqual([]);

        const tables = await listDbTables(db);
        expect(tables).not.toContain("widget");
        expect(tables).not.toContain("item");
        expect(tables).toContain("migration");
      },
      { migrationTable: "migration" },
    );
  });
});

describe("migrate + rollback (ts) with embedded mem://", () => {
  test("applies typescript migrations and creates tables", async () => {
    const fixture = await createFixture("ts");

    await withMemDb(
      async (db) => {
        const processed = await applyPendingMigrations(db, fixture);
        expect(processed).toHaveLength(2);

        const tables = await listDbTables(db);
        expect(tables).toContain("widget");
        expect(tables).toContain("item");

        await revertAllApplied(db, fixture);
        const after = await listDbTables(db);
        expect(after).not.toContain("widget");
        expect(after).not.toContain("item");
      },
      { migrationTable: "migration" },
    );
  });
});

describe("single migration manager ops (surql)", () => {
  test("applyPendingThrough applies through selected including it", async () => {
    const fixture = await createFixture("surql");

    await writeFile(
      path.join(
        fixture.cwd,
        fixture.migrationsDir,
        fixture.connectionName,
        "20260101000003_create-tag.up.surql",
      ),
      "DEFINE TABLE tag SCHEMALESS;\n",
    );
    await writeFile(
      path.join(
        fixture.cwd,
        fixture.migrationsDir,
        fixture.connectionName,
        "20260101000003_create-tag.down.surql",
      ),
      "REMOVE TABLE IF EXISTS tag;\n",
    );

    await withMemDb(
      async (db) => {
        const processed = await applyPendingThrough(
          db,
          fixture,
          "20260101000002_create-item",
        );
        expect(processed).toEqual([
          "20260101000001_create-widget",
          "20260101000002_create-item",
        ]);

        const applied = await fetchAppliedMigrationsOn(db, "migration");
        expect(applied.map((m) => m.id).sort()).toEqual([
          "20260101000001_create-widget",
          "20260101000002_create-item",
        ]);
        expect(applied.every((m) => m.batchNumber === applied[0]!.batchNumber)).toBe(
          true,
        );

        const tables = await listDbTables(db);
        expect(tables).toContain("widget");
        expect(tables).toContain("item");
        expect(tables).not.toContain("tag");
      },
      { migrationTable: "migration" },
    );
  });

  test("applyPendingThrough skips already-applied prefix", async () => {
    const fixture = await createFixture("surql");

    await writeFile(
      path.join(
        fixture.cwd,
        fixture.migrationsDir,
        fixture.connectionName,
        "20260101000003_create-tag.up.surql",
      ),
      "DEFINE TABLE tag SCHEMALESS;\n",
    );
    await writeFile(
      path.join(
        fixture.cwd,
        fixture.migrationsDir,
        fixture.connectionName,
        "20260101000003_create-tag.down.surql",
      ),
      "REMOVE TABLE IF EXISTS tag;\n",
    );

    await withMemDb(
      async (db) => {
        await applyMigration(db, fixture, "20260101000001_create-widget");
        const processed = await applyPendingThrough(
          db,
          fixture,
          "20260101000003_create-tag",
        );
        expect(processed).toEqual([
          "20260101000002_create-item",
          "20260101000003_create-tag",
        ]);
      },
      { migrationTable: "migration" },
    );
  });

  test("applyPendingThrough is a no-op when none pending through id", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        await applyPendingMigrations(db, fixture);
        const again = await applyPendingThrough(
          db,
          fixture,
          "20260101000002_create-item",
        );
        expect(again).toEqual([]);
      },
      { migrationTable: "migration" },
    );
  });

  test("applies one pending while earlier stays pending", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        const processed = await applyMigration(
          db,
          fixture,
          "20260101000002_create-item",
        );
        expect(processed).toEqual(["20260101000002_create-item"]);

        const applied = await fetchAppliedMigrationsOn(db, "migration");
        expect(applied.map((m) => m.id)).toEqual([
          "20260101000002_create-item",
        ]);

        const tables = await listDbTables(db);
        expect(tables).toContain("item");
        expect(tables).not.toContain("widget");
      },
      { migrationTable: "migration" },
    );
  });

  test("applyMigration is a no-op when already applied", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        await applyMigration(db, fixture, "20260101000001_create-widget");
        const again = await applyMigration(
          db,
          fixture,
          "20260101000001_create-widget",
        );
        expect(again).toEqual([]);
      },
      { migrationTable: "migration" },
    );
  });

  test("reverts one applied while later stays applied", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        await applyPendingMigrations(db, fixture);

        const reverted = await revertMigration(
          db,
          fixture,
          "20260101000001_create-widget",
        );
        expect(reverted).toEqual(["20260101000001_create-widget"]);

        const applied = await fetchAppliedMigrationsOn(db, "migration");
        expect(applied.map((m) => m.id)).toEqual([
          "20260101000002_create-item",
        ]);

        const tables = await listDbTables(db);
        expect(tables).not.toContain("widget");
        expect(tables).toContain("item");
      },
      { migrationTable: "migration" },
    );
  });

  test("revertMigration is a no-op when not applied", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        const reverted = await revertMigration(
          db,
          fixture,
          "20260101000001_create-widget",
        );
        expect(reverted).toEqual([]);
      },
      { migrationTable: "migration" },
    );
  });

  test("revertMigrationsAfter leaves selected applied", async () => {
    const fixture = await createFixture("surql");

    await withMemDb(
      async (db) => {
        await applyPendingMigrations(db, fixture);

        await writeFile(
          path.join(
            fixture.cwd,
            fixture.migrationsDir,
            fixture.connectionName,
            "20260101000003_create-tag.up.surql",
          ),
          "DEFINE TABLE tag SCHEMALESS;\n",
        );
        await writeFile(
          path.join(
            fixture.cwd,
            fixture.migrationsDir,
            fixture.connectionName,
            "20260101000003_create-tag.down.surql",
          ),
          "REMOVE TABLE IF EXISTS tag;\n",
        );
        await applyPendingMigrations(db, fixture);

        const reverted = await revertMigrationsAfter(
          db,
          fixture,
          "20260101000001_create-widget",
        );
        expect(reverted).toEqual([
          "20260101000003_create-tag",
          "20260101000002_create-item",
        ]);

        const applied = await fetchAppliedMigrationsOn(db, "migration");
        expect(applied.map((m) => m.id)).toEqual([
          "20260101000001_create-widget",
        ]);

        const tables = await listDbTables(db);
        expect(tables).toContain("widget");
        expect(tables).not.toContain("item");
        expect(tables).not.toContain("tag");
      },
      { migrationTable: "migration" },
    );
  });
});
