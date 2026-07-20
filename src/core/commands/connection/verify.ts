import type { Connection } from "../../config.ts";
import {
  ensureMigrationTable,
  verifyConnection,
} from "../../db.ts";
import type { ConnectionCredentials } from "../../env.ts";

/** Default wait for create/edit connection verification. */
export const DEFAULT_VERIFY_TIMEOUT_MS = 30_000;

export type VerifyConnectionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      stage: "verify" | "table";
      cancelled?: boolean;
    };

/** Race a promise against a timeout and optional AbortSignal. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw new DOMException("Connection check cancelled", "AbortError");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  try {
    return await new Promise<T>((resolve, reject) => {
      const settle = (fn: () => void) => {
        if (timer !== undefined) clearTimeout(timer);
        if (signal && onAbort) {
          signal.removeEventListener("abort", onAbort);
        }
        fn();
      };

      timer = setTimeout(() => {
        settle(() => reject(new Error(message)));
      }, timeoutMs);

      if (signal) {
        onAbort = () => {
          settle(() =>
            reject(new DOMException("Connection check cancelled", "AbortError")),
          );
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }

      promise.then(
        (value) => settle(() => resolve(value)),
        (err) => settle(() => reject(err)),
      );
    });
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (signal && onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError")
  );
}

/**
 * Check that the endpoint accepts credentials, then optionally ensure the
 * migration tracking table exists. Does not write config or .env.
 *
 * Fails if the overall operation exceeds `timeoutMs` (default 30s), or if
 * `signal` is aborted (Esc cancel in the TUI).
 */
export async function verifyConnectionConnectivity(
  connection: Pick<
    Connection,
    "endpoint" | "namespace" | "database" | "migrationTable"
  >,
  credentials: ConnectionCredentials,
  options?: {
    ensureTable?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<VerifyConnectionResult> {
  const ensureTable = options?.ensureTable ?? true;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS;
  const timeoutMessage = `Connection timed out after ${Math.round(timeoutMs / 1000)}s`;

  try {
    return await withTimeout(
      (async (): Promise<VerifyConnectionResult> => {
        const verified = await verifyConnection(connection, credentials);
        if (!verified.ok) {
          return { ok: false, error: verified.error, stage: "verify" };
        }

        if (ensureTable) {
          const table = await ensureMigrationTable(connection, credentials);
          if (!table.ok) {
            return { ok: false, error: table.error, stage: "table" };
          }
        }

        return { ok: true };
      })(),
      timeoutMs,
      timeoutMessage,
      options?.signal,
    );
  } catch (err) {
    if (isAbortError(err)) {
      return {
        ok: false,
        error: "Connection check cancelled",
        stage: "verify",
        cancelled: true,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, stage: "verify" };
  }
}
