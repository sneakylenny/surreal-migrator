import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  connectionMigrationsDir,
  migrationBaseName,
  migrationPaths,
  migrationTimestamp,
} from "./create.ts";

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
