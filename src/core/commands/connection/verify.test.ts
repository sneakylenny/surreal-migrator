import { describe, expect, test } from "bun:test";
import {
  DEFAULT_VERIFY_TIMEOUT_MS,
  withTimeout,
  verifyConnectionConnectivity,
} from "./verify.ts";

describe("connection verify timeout", () => {
  test("defaults to 30 seconds", () => {
    expect(DEFAULT_VERIFY_TIMEOUT_MS).toBe(30_000);
  });

  test("withTimeout rejects after the deadline", async () => {
    const pending = new Promise<string>(() => {});
    await expect(
      withTimeout(pending, 50, "Connection timed out after 0s"),
    ).rejects.toThrow("Connection timed out after 0s");
  });

  test("withTimeout resolves when the work finishes first", async () => {
    const value = await withTimeout(
      Promise.resolve("ok"),
      1_000,
      "Connection timed out after 1s",
    );
    expect(value).toBe("ok");
  });

  test("withTimeout rejects when the signal aborts", async () => {
    const pending = new Promise<string>(() => {});
    const controller = new AbortController();
    const raced = withTimeout(
      pending,
      5_000,
      "Connection timed out after 5s",
      controller.signal,
    );
    controller.abort();
    await expect(raced).rejects.toMatchObject({ name: "AbortError" });
  });

  test("verifyConnectionConnectivity reports cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await verifyConnectionConnectivity(
      {
        endpoint: "ws://127.0.0.1:1",
        namespace: "test",
        database: "test",
        migrationTable: "migration",
      },
      { username: "root", password: "root" },
      { signal: controller.signal, ensureTable: false },
    );
    expect(result).toEqual({
      ok: false,
      error: "Connection check cancelled",
      stage: "verify",
      cancelled: true,
    });
  });
});
