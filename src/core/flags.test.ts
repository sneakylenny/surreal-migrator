import { describe, expect, test } from "bun:test";
import {
  assertFormatSupported,
  formatToPersist,
  migrationFormatOptions,
} from "./flags.ts";
import {
  resolveMigrationFormat,
  type Config,
  type Connection,
} from "./config.ts";

function conn(
  overrides: Partial<Connection> = {},
): Connection {
  return {
    name: "local",
    endpoint: "ws://localhost:8000",
    namespace: "main",
    database: "main",
    migrationTable: "migration",
    migrationFormat: null,
    ...overrides,
  };
}

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    migrationsDir: "surreal",
    defaultConnection: null,
    migrationFormat: null,
    connections: [],
    ...overrides,
  };
}

describe("migrationFormatOptions", () => {
  test("includes TypeScript when enabled", () => {
    expect(migrationFormatOptions(true).map((o) => o.value)).toEqual([
      "surql",
      "ts",
    ]);
  });

  test("SurQL only when TypeScript is disabled", () => {
    expect(migrationFormatOptions(false).map((o) => o.value)).toEqual([
      "surql",
    ]);
  });
});

describe("assertFormatSupported", () => {
  test("allows surql always", () => {
    expect(assertFormatSupported("surql", false)).toBeNull();
    expect(assertFormatSupported("surql", true)).toBeNull();
  });

  test("rejects ts when disabled", () => {
    expect(assertFormatSupported("ts", false)).toContain(
      "TypeScript migrations are not supported",
    );
  });

  test("allows ts when enabled", () => {
    expect(assertFormatSupported("ts", true)).toBeNull();
  });
});

describe("formatToPersist", () => {
  test("omits surql and keeps ts", () => {
    expect(formatToPersist("surql")).toBeNull();
    expect(formatToPersist("ts")).toBe("ts");
  });
});

describe("resolveMigrationFormat", () => {
  test("defaults to surql when unset", () => {
    expect(resolveMigrationFormat(baseConfig(), conn())).toBe("surql");
  });

  test("uses connection override", () => {
    expect(
      resolveMigrationFormat(baseConfig(), conn({ migrationFormat: "ts" })),
    ).toBe("ts");
  });

  test("falls back to project format", () => {
    expect(
      resolveMigrationFormat(
        baseConfig({ migrationFormat: "ts" }),
        conn(),
      ),
    ).toBe("ts");
  });
});
