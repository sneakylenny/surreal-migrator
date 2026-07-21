import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Config, Connection } from "../../config.ts";
import {
  connectionMigrationsDir,
  createMigration,
  deleteMigrationFiles,
  migrationBaseName,
  migrationPaths,
  migrationTimestamp,
} from "./create.ts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempCwd(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "surreal-migrator-"));
  tempDirs.push(dir);
  return dir;
}

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    migrationsDir: "surreal",
    defaultConnection: null,
    migrationFormat: "surql",
    connections: [],
    ...overrides,
  };
}

function testConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    name: "demo",
    endpoint: "ws://127.0.0.1:8000/rpc",
    namespace: "test",
    database: "test",
    migrationTable: "migration",
    migrationFormat: null,
    ...overrides,
  };
}

describe("migrationTimestamp", () => {
  test("formats local time as YYYYMMDDHHmmss", () => {
    const date = new Date(2026, 6, 16, 16, 54, 7); // Jul 16 2026 16:54:07
    expect(migrationTimestamp(date)).toBe("20260716165407");
  });
});

describe("migrationBaseName", () => {
  test("joins timestamp and kebab name", () => {
    expect(migrationBaseName("20260716165400", "add-users")).toBe(
      "20260716165400_add-users",
    );
  });
});

describe("migrationPaths", () => {
  test("returns up/down surql paths", () => {
    const dir = "/tmp/surreal/my-connection";
    expect(migrationPaths("surql", dir, "20260716165400_add-users")).toEqual([
      path.join(dir, "20260716165400_add-users.up.surql"),
      path.join(dir, "20260716165400_add-users.down.surql"),
    ]);
  });

  test("returns single ts path", () => {
    const dir = "/tmp/surreal/my-connection";
    expect(migrationPaths("ts", dir, "20260716165400_add-users")).toEqual([
      path.join(dir, "20260716165400_add-users.ts"),
    ]);
  });
});

describe("connectionMigrationsDir", () => {
  test("resolves under migrationsDir/connectionName", () => {
    expect(connectionMigrationsDir("surreal", "my-connection", "/proj")).toBe(
      path.resolve("/proj", "surreal", "my-connection"),
    );
  });
});

describe("deleteMigrationFiles", () => {
  test("deletes surql up and down files", async () => {
    const cwd = await tempCwd();
    const config = testConfig();
    const connection = testConnection();
    const created = await createMigration(config, connection, "add-users", cwd);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const id = path.basename(created.files[0]!, ".up.surql");
    const result = await deleteMigrationFiles(config, connection, id, cwd);
    expect(result).toEqual({ ok: true, files: created.files });
    for (const file of created.files) {
      expect(await Bun.file(file).exists()).toBe(false);
    }
  });

  test("returns error when no files exist", async () => {
    const cwd = await tempCwd();
    const result = await deleteMigrationFiles(
      testConfig(),
      testConnection(),
      "20260716165400_missing",
      cwd,
    );
    expect(result).toEqual({
      ok: false,
      error: "No local migration files found",
    });
  });
});
