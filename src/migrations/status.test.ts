import { describe, expect, test } from "bun:test";
import { recordIdKey } from "../db.ts";
import {
  formatPendingHint,
  formatPendingOverview,
  formatRollbackHint,
  latestBatchSize,
  migrationIdFromFilename,
} from "./status.ts";

describe("migrationIdFromFilename", () => {
  test("parses surql up files", () => {
    expect(
      migrationIdFromFilename("20260716173536_add-users.up.surql", "surql"),
    ).toBe("20260716173536_add-users");
    expect(
      migrationIdFromFilename("20260716173536_add-users.down.surql", "surql"),
    ).toBeNull();
  });

  test("parses ts files", () => {
    expect(migrationIdFromFilename("20260716173536_add-users.ts", "ts")).toBe(
      "20260716173536_add-users",
    );
  });
});

describe("recordIdKey", () => {
  test("extracts id from RecordId-like objects", () => {
    expect(recordIdKey({ id: "20260716173536_add-users" })).toBe(
      "20260716173536_add-users",
    );
    expect(recordIdKey({ id: "⟨20260716173536_add-users⟩" })).toBe(
      "20260716173536_add-users",
    );
  });

  test("extracts id from string record ids", () => {
    expect(recordIdKey("migration:20260716173536_add-users")).toBe(
      "20260716173536_add-users",
    );
  });
});

describe("pending formatting", () => {
  test("hint reflects counts", () => {
    expect(
      formatPendingHint({
        local: [],
        applied: [],
        pending: [],
        latestBatchCount: 0,
      }),
    ).toBe("up to date");
    expect(
      formatPendingHint({
        local: ["a"],
        applied: [],
        pending: ["a"],
        latestBatchCount: 0,
      }),
    ).toBe("1 pending");
  });

  test("overview lists pending ids", () => {
    const lines = formatPendingOverview({
      local: ["a", "b"],
      applied: [],
      pending: ["a", "b"],
      latestBatchCount: 0,
    });
    expect(lines[0]).toBe("2 pending migrations:");
    expect(lines).toContain("  • a");
    expect(lines).toContain("  • b");
  });
});

describe("rollback hint", () => {
  test("latestBatchSize counts only the newest batch", () => {
    expect(latestBatchSize([])).toBe(0);
    expect(
      latestBatchSize([
        { batchNumber: 1 },
        { batchNumber: 2 },
        { batchNumber: 2 },
      ]),
    ).toBe(2);
  });

  test("formatRollbackHint messages", () => {
    expect(
      formatRollbackHint({
        local: [],
        applied: [],
        pending: [],
        latestBatchCount: 0,
      }),
    ).toBe("nothing to roll back");
    expect(
      formatRollbackHint({
        local: [],
        applied: ["a"],
        pending: [],
        latestBatchCount: 1,
      }),
    ).toBe("1 migration");
    expect(
      formatRollbackHint({
        local: [],
        applied: ["a", "b"],
        pending: [],
        latestBatchCount: 2,
      }),
    ).toBe("2 migrations");
  });
});
