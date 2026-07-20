import { describe, expect, test } from "bun:test";
import { parseCliArgs } from "./parse.ts";

describe("parseCliArgs", () => {
  test("parses help", () => {
    expect(parseCliArgs(["--help"])).toEqual({
      ok: true,
      command: { kind: "help", topic: undefined },
    });
    expect(parseCliArgs(["help", "up"])).toEqual({
      ok: true,
      command: { kind: "help", topic: "up" },
    });
  });

  test("parses init", () => {
    expect(parseCliArgs(["init"])).toEqual({
      ok: true,
      command: { kind: "init" },
    });
  });

  test("parses status with connection", () => {
    expect(parseCliArgs(["status", "-c", "demo"])).toEqual({
      ok: true,
      command: { kind: "status", connection: "demo" },
    });
  });

  test("parses create", () => {
    expect(parseCliArgs(["create", "add-users", "--connection", "demo"])).toEqual({
      ok: true,
      command: {
        kind: "create",
        name: "add-users",
        connection: "demo",
      },
    });
  });

  test("parses up modes", () => {
    expect(parseCliArgs(["up"])).toEqual({
      ok: true,
      command: { kind: "up", mode: "all", connection: undefined },
    });
    expect(parseCliArgs(["up", "20260101000000_a"])).toEqual({
      ok: true,
      command: {
        kind: "up",
        mode: "one",
        id: "20260101000000_a",
        connection: undefined,
      },
    });
    expect(parseCliArgs(["up", "--through", "20260101000000_a"])).toEqual({
      ok: true,
      command: {
        kind: "up",
        mode: "through",
        id: "20260101000000_a",
        connection: undefined,
      },
    });
  });

  test("rejects conflicting up modes", () => {
    const result = parseCliArgs([
      "up",
      "20260101000000_a",
      "--through",
      "20260101000000_b",
    ]);
    expect(result.ok).toBe(false);
  });

  test("parses down modes", () => {
    expect(parseCliArgs(["down"])).toEqual({
      ok: true,
      command: { kind: "down", mode: "batch", connection: undefined },
    });
    expect(parseCliArgs(["down", "--all"])).toEqual({
      ok: true,
      command: { kind: "down", mode: "all", connection: undefined },
    });
    expect(parseCliArgs(["down", "id1"])).toEqual({
      ok: true,
      command: {
        kind: "down",
        mode: "one",
        id: "id1",
        connection: undefined,
      },
    });
    expect(parseCliArgs(["down", "--after", "id1"])).toEqual({
      ok: true,
      command: {
        kind: "down",
        mode: "after",
        id: "id1",
        connection: undefined,
      },
    });
  });

  test("rejects conflicting down modes", () => {
    expect(parseCliArgs(["down", "--all", "id1"]).ok).toBe(false);
    expect(parseCliArgs(["down", "--all", "--after", "id1"]).ok).toBe(false);
  });

  test("parses forget and delete-files", () => {
    expect(parseCliArgs(["forget", "id1", "-c", "demo"])).toEqual({
      ok: true,
      command: { kind: "forget", id: "id1", connection: "demo" },
    });
    expect(parseCliArgs(["delete-files", "id1"])).toEqual({
      ok: true,
      command: {
        kind: "delete-files",
        id: "id1",
        connection: undefined,
      },
    });
  });

  test("parses connection list", () => {
    expect(parseCliArgs(["connection", "list"])).toEqual({
      ok: true,
      command: { kind: "connection-list" },
    });
  });

  test("parses connection add", () => {
    expect(
      parseCliArgs([
        "connection",
        "add",
        "--name",
        "demo",
        "--endpoint",
        "ws://localhost:8000",
        "--namespace",
        "ns",
        "--database",
        "db",
        "--username",
        "root",
        "--password",
        "root",
        "--format",
        "ts",
        "--default",
        "--skip-verify",
      ]),
    ).toEqual({
      ok: true,
      command: {
        kind: "connection-add",
        name: "demo",
        endpoint: "ws://localhost:8000",
        namespace: "ns",
        database: "db",
        username: "root",
        password: "root",
        table: "migration",
        format: "ts",
        makeDefault: true,
        skipVerify: true,
      },
    });
  });

  test("requires connection add flags", () => {
    const result = parseCliArgs(["connection", "add", "--name", "demo"]);
    expect(result.ok).toBe(false);
  });

  test("parses connection update partial flags", () => {
    expect(
      parseCliArgs([
        "connection",
        "update",
        "demo",
        "--endpoint",
        "ws://other:8000",
      ]),
    ).toEqual({
      ok: true,
      command: {
        kind: "connection-update",
        name: "demo",
        endpoint: "ws://other:8000",
        namespace: undefined,
        database: undefined,
        username: undefined,
        password: undefined,
        table: undefined,
        format: undefined,
        makeDefault: undefined,
        skipVerify: false,
      },
    });
  });

  test("rejects unknown command", () => {
    const result = parseCliArgs(["nope"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Unknown command");
    }
  });
});
