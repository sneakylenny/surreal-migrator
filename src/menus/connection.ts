import * as p from "@clack/prompts";
import type { Config, Connection } from "../config.ts";
import { createMigration } from "../migrations/create.ts";
import { theme } from "../theme.ts";

export type ConnectionMenuResult = {
  status: "back" | "quit";
  config: Config;
};

export async function showConnectionMenu(
  config: Config,
  connection: Connection,
): Promise<ConnectionMenuResult> {
  let current = config;

  while (true) {
    p.note(
      [
        `${theme.label("Endpoint")}  ${connection.endpoint}`,
        `${theme.label("Namespace")} ${connection.namespace}`,
        `${theme.label("Database")}  ${connection.database}`,
        `${theme.label("Table")}     ${connection.migrationTable}`,
        "",
        theme.muted("No pending migrations."),
      ].join("\n"),
      theme.title(connection.name),
    );

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "create", label: "Create migration" },
        { value: "run", label: "Run pending migrations", hint: "coming soon" },
        { value: "view", label: "View applied migrations", hint: "coming soon" },
        { value: "back", label: "Back" },
        { value: "quit", label: "Quit" },
      ],
    });

    if (p.isCancel(action)) {
      return { status: "back", config: current };
    }

    switch (action) {
      case "create":
        current = await createMigration(current, connection);
        break;
      case "run":
      case "view":
        p.log.warn(theme.muted("Not implemented yet — placeholder for later."));
        break;
      case "back":
        return { status: "back", config: current };
      case "quit":
        return { status: "quit", config: current };
    }
  }
}
