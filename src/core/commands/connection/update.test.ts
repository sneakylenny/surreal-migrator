import { describe, expect, test } from "bun:test";
import { afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Config, Connection } from "../../config.ts";
import { loadConfig } from "../../config.ts";
import { connectionEnvKey } from "../../env.ts";
import {
  updateConnection,
  validateUpdateConnectionInput,
  type UpdateConnectionInput,
} from "./update.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function conn(name: string, overrides: Partial<Connection> = {}): Connection {
  return {
    name,
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
    connections: [conn("local")],
    ...overrides,
  };
}

function input(
  overrides: Partial<UpdateConnectionInput> = {},
): UpdateConnectionInput {
  return {
    endpoint: "ws://localhost:8000",
    username: "root",
    password: "secret",
    namespace: "main",
    database: "main",
    migrationTable: "migration",
    migrationFormat: null,
    ...overrides,
  };
}

describe("validateUpdateConnectionInput", () => {
  test("accepts valid updates", () => {
    expect(
      validateUpdateConnectionInput(baseConfig(), "local", input()),
    ).toBeNull();
  });

  test("rejects unknown connection", () => {
    expect(
      validateUpdateConnectionInput(baseConfig(), "missing", input()),
    ).toContain("not found");
  });

  test("rejects empty namespace", () => {
    expect(
      validateUpdateConnectionInput(
        baseConfig(),
        "local",
        input({ namespace: "" }),
      ),
    ).toBe("Namespace is required");
  });
});

describe("updateConnection", () => {
  test("updates config and credentials", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "sm-upd-"));
    tempDirs.push(cwd);

    const result = await updateConnection(
      baseConfig(),
      "local",
      input({
        endpoint: "ws://db:8000",
        namespace: "app",
        password: "new-pass",
      }),
      { cwd, makeDefault: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.config.defaultConnection).toBe("local");
    expect(result.config.connections[0]?.endpoint).toBe("ws://db:8000");
    expect(result.config.connections[0]?.namespace).toBe("app");

    const loaded = await loadConfig(cwd);
    expect(loaded.connections[0]?.endpoint).toBe("ws://db:8000");

    const envText = await Bun.file(path.join(cwd, ".env")).text();
    expect(envText).toContain(
      `${connectionEnvKey("local", "PASSWORD")}=new-pass`,
    );
  });

  test("clears default when makeDefault is false", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "sm-upd-"));
    tempDirs.push(cwd);

    const result = await updateConnection(
      baseConfig({ defaultConnection: "local" }),
      "local",
      input(),
      { cwd, makeDefault: false },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.defaultConnection).toBeNull();
  });
});
