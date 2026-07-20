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
});
