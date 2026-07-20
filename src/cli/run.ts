import { ensureConfig } from "../core/setup.ts";
import { runConnectionAdd, runConnectionList, runConnectionUpdate } from "./commands/connection.ts";
import { runCreate } from "./commands/create.ts";
import { runDeleteFiles } from "./commands/delete-files.ts";
import { runDown } from "./commands/down.ts";
import { runForget } from "./commands/forget.ts";
import { runInit } from "./commands/init.ts";
import { runStatus } from "./commands/status.ts";
import { runUp } from "./commands/up.ts";
import { usageFor, usageOverview } from "./help.ts";
import { parseCliArgs } from "./parse.ts";

/** Run a direct CLI command. Returns process exit code. */
export async function runCli(
  argv: string[],
  cwd = process.cwd(),
): Promise<number> {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    if (parsed.helpTopic) {
      console.error("");
      console.error(usageFor(parsed.helpTopic));
    } else {
      console.error("");
      console.error(usageOverview());
    }
    return 1;
  }

  const { command } = parsed;

  if (command.kind === "help") {
    console.log(
      command.topic ? usageFor(command.topic) : usageOverview(),
    );
    return 0;
  }

  if (command.kind === "init") {
    return runInit(cwd);
  }

  // Remaining commands need config (bootstrap if missing, like TUI).
  const config = await ensureConfig(cwd);

  switch (command.kind) {
    case "status":
      return runStatus(config, command.connection, cwd);
    case "create":
      return runCreate(config, command.name, command.connection, cwd);
    case "up":
      return runUp(
        config,
        command.mode,
        command.id,
        command.connection,
        cwd,
      );
    case "down":
      return runDown(
        config,
        command.mode,
        command.id,
        command.connection,
        cwd,
      );
    case "forget":
      return runForget(config, command.id, command.connection, cwd);
    case "delete-files":
      return runDeleteFiles(config, command.id, command.connection, cwd);
    case "connection-list":
      return runConnectionList(config);
    case "connection-add":
      return runConnectionAdd(config, command, cwd);
    case "connection-update":
      return runConnectionUpdate(config, command, cwd);
  }
}
