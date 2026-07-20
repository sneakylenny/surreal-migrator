import { describe, expect, test } from "bun:test";
import { resolveConnection } from "./resolve.ts";
import type { Config } from "../core/config.ts";

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
  ],
};

describe("resolveConnection", () => {
  test("uses default when -c omitted", () => {
    const result = resolveConnection(config);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.connection.name).toBe("demo");
  });

  test("uses explicit name", () => {
    const result = resolveConnection(
      { ...config, defaultConnection: null },
      "demo",
    );
    expect(result.ok).toBe(true);
  });

  test("errors when missing", () => {
    const result = resolveConnection(
      { ...config, defaultConnection: null },
    );
    expect(result.ok).toBe(false);
  });
});
