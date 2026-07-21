import { parseArgs } from "node:util";
import type { MigrationFormat } from "../core/config.ts";

export type CliCommand =
  | { kind: "help"; topic?: string }
  | { kind: "init" }
  | { kind: "status"; connection?: string }
  | { kind: "create"; name: string; connection?: string }
  | {
      kind: "up";
      mode: "all" | "one" | "through";
      id?: string;
      connection?: string;
    }
  | {
      kind: "down";
      mode: "batch" | "all" | "one" | "after";
      id?: string;
      connection?: string;
    }
  | { kind: "forget"; id: string; connection?: string }
  | { kind: "delete-files"; id: string; connection?: string }
  | { kind: "connection-list" }
  | {
      kind: "connection-add";
      name: string;
      endpoint: string;
      namespace: string;
      database: string;
      username: string;
      password: string;
      table: string;
      format: MigrationFormat | null;
      makeDefault: boolean;
      skipVerify: boolean;
    }
  | {
      kind: "connection-update";
      name: string;
      endpoint?: string;
      namespace?: string;
      database?: string;
      username?: string;
      password?: string;
      table?: string;
      format?: MigrationFormat | null;
      makeDefault?: boolean;
      skipVerify: boolean;
    };

export type ParseResult =
  | { ok: true; command: CliCommand }
  | { ok: false; error: string; helpTopic?: string };

function isHelpFlag(token: string): boolean {
  return token === "-h" || token === "--help" || token === "help";
}

function optionalString(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value;
}

function requireFlag(
  flags: Record<string, unknown>,
  name: string,
): string | null {
  const value = flags[name];
  if (typeof value !== "string" || value.trim() === "") {
    return `--${name} is required`;
  }
  return null;
}

function parseFormat(
  raw: string | undefined,
): { ok: true; format: MigrationFormat | null } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, format: null };
  if (raw === "surql") return { ok: true, format: null };
  if (raw === "ts") return { ok: true, format: "ts" };
  return { ok: false, error: `--format must be surql or ts (got: ${raw})` };
}

function parseConnectionScoped(
  args: string[],
  command: string,
):
  | {
      ok: true;
      connection?: string;
      positionals: string[];
      values: Record<string, unknown>;
    }
  | { ok: false; error: string; helpTopic?: string } {
  try {
    const { values, positionals } = parseArgs({
      args,
      options: {
        connection: { type: "string", short: "c" },
        through: { type: "string" },
        after: { type: "string" },
        all: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
    if (values.help) {
      return { ok: false, error: "HELP", helpTopic: command };
    }
    return {
      ok: true,
      connection: optionalString(values.connection),
      positionals,
      values: values as Record<string, unknown>,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Parse argv (without the binary name) into a typed CLI command. */
export function parseCliArgs(argv: string[]): ParseResult {
  if (argv.length === 0) {
    return { ok: false, error: "No command provided. Pass a command or run with no args for the TUI." };
  }

  const [head, ...rest] = argv;
  if (!head) {
    return { ok: false, error: "No command provided." };
  }

  if (isHelpFlag(head)) {
    const topic = rest[0] && !rest[0].startsWith("-") ? rest[0] : undefined;
    return { ok: true, command: { kind: "help", topic } };
  }

  if (head === "init") {
    if (rest.some(isHelpFlag)) {
      return { ok: true, command: { kind: "help", topic: "init" } };
    }
    if (rest.length > 0) {
      return { ok: false, error: `Unexpected arguments for init: ${rest.join(" ")}` };
    }
    return { ok: true, command: { kind: "init" } };
  }

  if (head === "status") {
    const parsed = parseConnectionScoped(rest, "status");
    if (!parsed.ok) {
      if (parsed.error === "HELP") {
        return { ok: true, command: { kind: "help", topic: "status" } };
      }
      return parsed;
    }
    if (parsed.positionals.length > 0) {
      return {
        ok: false,
        error: `Unexpected arguments for status: ${parsed.positionals.join(" ")}`,
      };
    }
    if (parsed.values.through || parsed.values.after || parsed.values.all) {
      return { ok: false, error: "status does not accept --through, --after, or --all" };
    }
    return {
      ok: true,
      command: { kind: "status", connection: parsed.connection },
    };
  }

  if (head === "create") {
    const parsed = parseConnectionScoped(rest, "create");
    if (!parsed.ok) {
      if (parsed.error === "HELP") {
        return { ok: true, command: { kind: "help", topic: "create" } };
      }
      return parsed;
    }
    if (parsed.values.through || parsed.values.after || parsed.values.all) {
      return { ok: false, error: "create does not accept --through, --after, or --all" };
    }
    const name = parsed.positionals[0];
    if (!name || parsed.positionals.length !== 1) {
      return { ok: false, error: "Usage: create <name> [-c <connection>]", helpTopic: "create" };
    }
    return {
      ok: true,
      command: { kind: "create", name, connection: parsed.connection },
    };
  }

  if (head === "up") {
    const parsed = parseConnectionScoped(rest, "up");
    if (!parsed.ok) {
      if (parsed.error === "HELP") {
        return { ok: true, command: { kind: "help", topic: "up" } };
      }
      return parsed;
    }
    if (parsed.values.all || parsed.values.after) {
      return { ok: false, error: "up does not accept --all or --after" };
    }
    const through = optionalString(parsed.values.through as string | undefined);
    const id = parsed.positionals[0];
    if (parsed.positionals.length > 1) {
      return { ok: false, error: `Unexpected arguments for up: ${parsed.positionals.slice(1).join(" ")}` };
    }
    if (through && id) {
      return { ok: false, error: "Use either up <id> or up --through <id>, not both" };
    }
    if (through) {
      return {
        ok: true,
        command: {
          kind: "up",
          mode: "through",
          id: through,
          connection: parsed.connection,
        },
      };
    }
    if (id) {
      return {
        ok: true,
        command: {
          kind: "up",
          mode: "one",
          id,
          connection: parsed.connection,
        },
      };
    }
    return {
      ok: true,
      command: { kind: "up", mode: "all", connection: parsed.connection },
    };
  }

  if (head === "down") {
    const parsed = parseConnectionScoped(rest, "down");
    if (!parsed.ok) {
      if (parsed.error === "HELP") {
        return { ok: true, command: { kind: "help", topic: "down" } };
      }
      return parsed;
    }
    if (parsed.values.through) {
      return { ok: false, error: "down does not accept --through" };
    }
    const after = optionalString(parsed.values.after as string | undefined);
    const all = Boolean(parsed.values.all);
    const id = parsed.positionals[0];
    if (parsed.positionals.length > 1) {
      return {
        ok: false,
        error: `Unexpected arguments for down: ${parsed.positionals.slice(1).join(" ")}`,
      };
    }
    const modes = [all, Boolean(after), Boolean(id)].filter(Boolean).length;
    if (modes > 1) {
      return {
        ok: false,
        error: "Use only one of: down, down --all, down <id>, or down --after <id>",
      };
    }
    if (all) {
      return {
        ok: true,
        command: { kind: "down", mode: "all", connection: parsed.connection },
      };
    }
    if (after) {
      return {
        ok: true,
        command: {
          kind: "down",
          mode: "after",
          id: after,
          connection: parsed.connection,
        },
      };
    }
    if (id) {
      return {
        ok: true,
        command: {
          kind: "down",
          mode: "one",
          id,
          connection: parsed.connection,
        },
      };
    }
    return {
      ok: true,
      command: { kind: "down", mode: "batch", connection: parsed.connection },
    };
  }

  if (head === "forget") {
    const parsed = parseConnectionScoped(rest, "forget");
    if (!parsed.ok) {
      if (parsed.error === "HELP") {
        return { ok: true, command: { kind: "help", topic: "forget" } };
      }
      return parsed;
    }
    if (parsed.values.through || parsed.values.after || parsed.values.all) {
      return { ok: false, error: "forget does not accept --through, --after, or --all" };
    }
    const id = parsed.positionals[0];
    if (!id || parsed.positionals.length !== 1) {
      return { ok: false, error: "Usage: forget <id> [-c <connection>]", helpTopic: "forget" };
    }
    return {
      ok: true,
      command: { kind: "forget", id, connection: parsed.connection },
    };
  }

  if (head === "delete-files") {
    const parsed = parseConnectionScoped(rest, "delete-files");
    if (!parsed.ok) {
      if (parsed.error === "HELP") {
        return { ok: true, command: { kind: "help", topic: "delete-files" } };
      }
      return parsed;
    }
    if (parsed.values.through || parsed.values.after || parsed.values.all) {
      return {
        ok: false,
        error: "delete-files does not accept --through, --after, or --all",
      };
    }
    const id = parsed.positionals[0];
    if (!id || parsed.positionals.length !== 1) {
      return {
        ok: false,
        error: "Usage: delete-files <id> [-c <connection>]",
        helpTopic: "delete-files",
      };
    }
    return {
      ok: true,
      command: { kind: "delete-files", id, connection: parsed.connection },
    };
  }

  if (head === "connection") {
    return parseConnectionCommand(rest);
  }

  return {
    ok: false,
    error: `Unknown command: ${head}`,
    helpTopic: undefined,
  };
}

function parseConnectionCommand(args: string[]): ParseResult {
  const [sub, ...rest] = args;
  if (!sub || isHelpFlag(sub)) {
    return { ok: true, command: { kind: "help", topic: "connection" } };
  }

  if (sub === "list") {
    if (rest.some(isHelpFlag)) {
      return { ok: true, command: { kind: "help", topic: "connection" } };
    }
    if (rest.length > 0) {
      return { ok: false, error: `Unexpected arguments for connection list: ${rest.join(" ")}` };
    }
    return { ok: true, command: { kind: "connection-list" } };
  }

  if (sub === "add") {
    try {
      const { values, positionals } = parseArgs({
        args: rest,
        options: {
          name: { type: "string" },
          endpoint: { type: "string" },
          namespace: { type: "string" },
          database: { type: "string" },
          username: { type: "string" },
          password: { type: "string" },
          table: { type: "string", default: "migration" },
          format: { type: "string" },
          default: { type: "boolean", default: false },
          "skip-verify": { type: "boolean", default: false },
          help: { type: "boolean", short: "h", default: false },
        },
        allowPositionals: true,
        strict: true,
      });
      if (values.help) {
        return { ok: true, command: { kind: "help", topic: "connection" } };
      }
      if (positionals.length > 0) {
        return {
          ok: false,
          error: `Unexpected arguments for connection add: ${positionals.join(" ")}`,
        };
      }
      for (const key of [
        "name",
        "endpoint",
        "namespace",
        "database",
        "username",
        "password",
      ] as const) {
        const missing = requireFlag(values as Record<string, unknown>, key);
        if (missing) return { ok: false, error: missing, helpTopic: "connection" };
      }
      const format = parseFormat(values.format);
      if (!format.ok) return format;
      return {
        ok: true,
        command: {
          kind: "connection-add",
          name: values.name!,
          endpoint: values.endpoint!,
          namespace: values.namespace!,
          database: values.database!,
          username: values.username!,
          password: values.password!,
          table: values.table ?? "migration",
          format: format.format,
          makeDefault: Boolean(values.default),
          skipVerify: Boolean(values["skip-verify"]),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message, helpTopic: "connection" };
    }
  }

  if (sub === "update") {
    const name = rest[0];
    if (!name || name.startsWith("-")) {
      return {
        ok: false,
        error: "Usage: connection update <name> [options]",
        helpTopic: "connection",
      };
    }
    if (isHelpFlag(name)) {
      return { ok: true, command: { kind: "help", topic: "connection" } };
    }
    try {
      const { values, positionals } = parseArgs({
        args: rest.slice(1),
        options: {
          endpoint: { type: "string" },
          namespace: { type: "string" },
          database: { type: "string" },
          username: { type: "string" },
          password: { type: "string" },
          table: { type: "string" },
          format: { type: "string" },
          default: { type: "boolean" },
          "skip-verify": { type: "boolean", default: false },
          help: { type: "boolean", short: "h", default: false },
        },
        allowPositionals: true,
        strict: true,
      });
      if (values.help) {
        return { ok: true, command: { kind: "help", topic: "connection" } };
      }
      if (positionals.length > 0) {
        return {
          ok: false,
          error: `Unexpected arguments for connection update: ${positionals.join(" ")}`,
        };
      }
      const format =
        values.format === undefined
          ? undefined
          : parseFormat(values.format);
      if (format && !format.ok) return format;
      return {
        ok: true,
        command: {
          kind: "connection-update",
          name,
          endpoint: optionalString(values.endpoint),
          namespace: optionalString(values.namespace),
          database: optionalString(values.database),
          username: optionalString(values.username),
          password: optionalString(values.password),
          table: optionalString(values.table),
          format: format?.ok ? format.format : undefined,
          makeDefault:
            values.default === undefined ? undefined : Boolean(values.default),
          skipVerify: Boolean(values["skip-verify"]),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message, helpTopic: "connection" };
    }
  }

  return {
    ok: false,
    error: `Unknown connection subcommand: ${sub}`,
    helpTopic: "connection",
  };
}
