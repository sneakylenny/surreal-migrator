import { describe, expect, test } from "bun:test";
import {
  formatIdList,
  formatSessionEvent,
  formatSessionSummary,
} from "./session-log.ts";

describe("formatIdList", () => {
  test("joins one, two, and many ids", () => {
    expect(formatIdList([])).toBe("nothing");
    expect(formatIdList(["a"])).toBe("a");
    expect(formatIdList(["a", "b"])).toBe("a and b");
    expect(formatIdList(["a", "b", "c"])).toBe("a, b, and c");
  });
});

describe("formatSessionEvent", () => {
  test("formats common actions", () => {
    expect(
      formatSessionEvent({
        kind: "opened_connection",
        at: 0,
        name: "demo",
      }),
    ).toBe("Opened connection demo");
    expect(
      formatSessionEvent({
        kind: "migrated",
        at: 0,
        connection: "demo",
        ids: ["a", "b", "c"],
      }),
    ).toBe("Migrated a, b, and c");
    expect(
      formatSessionEvent({
        kind: "rolled_back",
        at: 0,
        connection: "demo",
        ids: ["a"],
      }),
    ).toBe("Rolled back a");
    expect(
      formatSessionEvent({
        kind: "deleted_files",
        at: 0,
        connection: "demo",
        files: ["surreal/demo/a.up.surql", "surreal/demo/a.down.surql"],
      }),
    ).toBe(
      "Deleted migration files surreal/demo/a.up.surql and surreal/demo/a.down.surql",
    );
  });
});

describe("formatSessionSummary", () => {
  test("empty and populated", () => {
    expect(formatSessionSummary([])).toEqual([
      "No activity yet this session.",
    ]);
    expect(
      formatSessionSummary([
        { kind: "opened_connection", at: 0, name: "demo" },
        {
          kind: "migrated",
          at: 1,
          connection: "demo",
          ids: ["a", "b"],
        },
      ]),
    ).toEqual([
      "Session activity (2 events)",
      "",
      "• Opened connection demo",
      "• Migrated a and b",
    ]);
  });

  test("formats failed actions with error detail", () => {
    expect(
      formatSessionSummary([
        {
          kind: "failed",
          at: 0,
          action: "roll back",
          error: "Missing local source for x",
        },
      ]),
    ).toEqual([
      "Session activity (1 event)",
      "",
      "• Tried to roll back but failed:",
      "  Missing local source for x",
    ]);
  });
});
