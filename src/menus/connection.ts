import * as p from "@clack/prompts";
import type { Config, Connection } from "../config.ts";
import { theme } from "../theme.ts";

export async function showConnectionMenu(
  config: Config,
  connection: Connection,
): Promise<"back" | "quit"> {
  while (true) {
    p.note(
      [
        `${theme.label("Endpoint")}  ${connection.endpoint}`,
        `${theme.label("Namespace")} ${connection.namespace}`,
        `${theme.label("Database")}  ${connection.database}`,
        "",
        theme.muted("No pending migrations."),
      ].join("\n"),
      theme.title(connection.name),
    );

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "create", label: "Create migration", hint: "coming soon" },
        { value: "run", label: "Run pending migrations", hint: "coming soon" },
        { value: "view", label: "View applied migrations", hint: "coming soon" },
        { value: "back", label: "Back" },
        { value: "quit", label: "Quit" },
      ],
    });

    if (p.isCancel(action)) {
      return "back";
    }

    switch (action) {
      case "create":
      case "run":
      case "view":
        p.log.warn(theme.muted("Not implemented yet — placeholder for later."));
        break;
      case "back":
        return "back";
      case "quit":
        return "quit";
    }
  }
}
