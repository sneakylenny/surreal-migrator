import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Config, Connection } from "../../config.ts";
import { loadConfig } from "../../config.ts";
import { connectionEnvKey } from "../../env.ts";
import {
  createConnection,
  normalizeCreateConnectionInput,
  validateCreateConnectionInput,
  type CreateConnectionInput,
} from "./create.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function conn(name: string): Connection {
  return {
    name,
    endpoint: "ws://localhost:8000",
    namespace: "main",
    database: "main",
    migrationTable: "migration",
    migrationFormat: null,
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

function input(
  overrides: Partial<CreateConnectionInput> = {},
): CreateConnectionInput {
  return {
    name: "local",
    endpoint: "ws://localhost:8000",
    username: "root",
    password: "root",
    namespace: "main",
    database: "main",
    migrationTable: "migration",
    migrationFormat: null,
    ...overrides,
  };
}

describe("validateCreateConnectionInput", () => {
  test("accepts a valid new connection", () => {
    expect(validateCreateConnectionInput(baseConfig(), input())).toBeNull();
  });

  test("rejects empty name", () => {
    expect(validateCreateConnectionInput(baseConfig(), input({ name: "  " }))).toBe(
      "Name is required",
    );
  });

  test("rejects non-kebab name", () => {
    expect(
      validateCreateConnectionInput(baseConfig(), input({ name: "MyConn" })),
    ).toContain("kebab-case");
  });

  test("rejects duplicate name", () => {
    const config = baseConfig({ connections: [conn("local")] });
    expect(validateCreateConnectionInput(config, input({ name: "local" }))).toContain(
      "already exists",
    );
  });

  test("rejects missing namespace/database", () => {
    expect(
      validateCreateConnectionInput(baseConfig(), input({ namespace: "" })),
    ).toBe("Namespace is required");
    expect(
      validateCreateConnectionInput(baseConfig(), input({ database: " " })),
    ).toBe("Database is required");
  });

  test("rejects invalid migration table", () => {
    expect(
      validateCreateConnectionInput(
        baseConfig(),
        input({ migrationTable: "Bad-Table" }),
      ),
    ).toContain("lowercase identifier");
  });
});

describe("normalizeCreateConnectionInput", () => {
  test("applies defaults for endpoint, username, and table", () => {
    const normalized = normalizeCreateConnectionInput(
      input({
        endpoint: "",
        username: "",
        password: "",
        migrationTable: "",
      }),
    );
    expect(normalized.connection.endpoint).toBe("ws://localhost:8000");
    expect(normalized.connection.migrationTable).toBe("migration");
    expect(normalized.credentials).toEqual({
      username: "root",
      password: "",
    });
  });
});

describe("createConnection", () => {
  test("persists config and credentials", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "sm-conn-"));
    tempDirs.push(cwd);

    const result = await createConnection(baseConfig(), input(), {
      cwd,
      makeDefault: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.config.defaultConnection).toBe("local");
    expect(result.config.connections).toHaveLength(1);

    const loaded = await loadConfig(cwd);
    expect(loaded.connections[0]?.name).toBe("local");
    expect(loaded.defaultConnection).toBe("local");

    const envText = await Bun.file(path.join(cwd, ".env")).text();
    expect(envText).toContain(`${connectionEnvKey("local", "USERNAME")}=root`);
    expect(envText).toContain(`${connectionEnvKey("local", "PASSWORD")}=root`);
  });

  test("does not set default unless requested", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "sm-conn-"));
    tempDirs.push(cwd);

    const result = await createConnection(baseConfig(), input(), { cwd });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.defaultConnection).toBeNull();
  });
});
