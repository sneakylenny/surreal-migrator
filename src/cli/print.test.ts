import { describe, expect, test } from "bun:test";
import {
  formatRunResultLines,
  formatStatusLines,
  formatConnectionList,
} from "./print.ts";
import type { Config } from "../core/config.ts";

describe("formatRunResultLines", () => {
  test("formats success and empty", () => {
    expect(
      formatRunResultLines(
        "Migrated",
        { ok: true, processed: ["a", "b"], skipped: [] },
        "No pending migrations.",
      ),
    ).toEqual(["Migrated (2): a, b"]);
    expect(
      formatRunResultLines(
        "Migrated",
        { ok: true, processed: [], skipped: [] },
        "No pending migrations.",
      ),
    ).toEqual(["No pending migrations."]);
  });

  test("formats failure with partial progress", () => {
    expect(
      formatRunResultLines(
        "Migrated",
        { ok: false, error: "boom", processed: ["a"], skipped: [] },
        "No pending migrations.",
      ),
    ).toEqual(["boom", "Stopped after: a"]);
  });
});

describe("formatStatusLines", () => {
  test("lists entries", () => {
    const lines = formatStatusLines({
      local: ["a", "b"],
      applied: ["a"],
      pending: ["b"],
      missing: [],
      latestBatchCount: 1,
    });
    expect(lines[0]).toContain("Applied: 1");
    expect(lines.join("\n")).toContain("a  applied");
    expect(lines.join("\n")).toContain("b  pending");
  });
});

describe("formatConnectionList", () => {
  test("marks default", () => {
    const config: Config = {
      migrationsDir: "surreal",
      defaultConnection: "demo",
      migrationFormat: null,
      connections: [
        {
          name: "demo",
          endpoint: "ws://localhost:8000",
          namespace: "n",
          database: "d",
          migrationTable: "migration",
          migrationFormat: null,
        },
        {
          name: "other",
          endpoint: "ws://localhost:8000",
          namespace: "n",
          database: "d",
          migrationTable: "migration",
          migrationFormat: null,
        },
      ],
    };
    expect(formatConnectionList(config)).toEqual([
      "demo (default)",
      "other",
    ]);
  });
});
