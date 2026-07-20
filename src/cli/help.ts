export const CLI_NAME = "surreal-migrator";

export function usageOverview(): string {
  return `${CLI_NAME} — SurrealDB migration CLI

Usage:
  ${CLI_NAME}                         Open interactive TUI
  ${CLI_NAME} <command> [options]

Commands:
  init                          Create surreal.config.json if missing
  status                        Show applied / pending / missing migrations
  create <name>                 Create a new migration (kebab-case name)
  up [id]                       Apply pending migrations (or one id)
  down [id]                     Roll back latest batch (or one id)
  forget <id>                   Delete DB migration record only (no down)
  delete-files <id>             Delete local migration source files
  connection list               List configured connections
  connection add                Add a connection (flags required)
  connection update <name>      Update a connection

Global options:
  -c, --connection <name>       Connection (or use defaultConnection)
  -h, --help                    Show help

Up options:
  --through <id>                Apply pending through id (inclusive)

Down options:
  --all                         Roll back all applied migrations
  --after <id>                  Roll back migrations after id

Connection add options:
  --name --endpoint --namespace --database --username --password
  --table <name>                Migration table (default: migration)
  --format surql|ts             Migration format
  --default                     Set as default connection
  --skip-verify                 Skip connectivity check

Connection update options:
  --endpoint --namespace --database --username --password
  --table --format --default --skip-verify
  (omitted fields keep current values)

Exit codes: 0 success / nothing to do; 1 error

Full reference: https://github.com/sneakylenny/surreal-migrator/blob/main/docs/CLI.md`;
}

export function usageFor(topic: string): string {
  switch (topic) {
    case "init":
      return `Usage: ${CLI_NAME} init

Create surreal.config.json and the default migrations directory if missing.`;
    case "status":
      return `Usage: ${CLI_NAME} status [-c <connection>]

Print applied, pending, and missing-source migrations for a connection.`;
    case "create":
      return `Usage: ${CLI_NAME} create <name> [-c <connection>]

Create timestamped migration files (kebab-case name).`;
    case "up":
      return `Usage:
  ${CLI_NAME} up [-c <connection>]
  ${CLI_NAME} up <id> [-c <connection>]
  ${CLI_NAME} up --through <id> [-c <connection>]

Apply all pending, a single migration, or pending through an id.`;
    case "down":
      return `Usage:
  ${CLI_NAME} down [-c <connection>]
  ${CLI_NAME} down --all [-c <connection>]
  ${CLI_NAME} down <id> [-c <connection>]
  ${CLI_NAME} down --after <id> [-c <connection>]

Default rolls back the latest batch only.`;
    case "forget":
      return `Usage: ${CLI_NAME} forget <id> [-c <connection>]

Delete the DB migration history row only (does not run down).`;
    case "delete-files":
      return `Usage: ${CLI_NAME} delete-files <id> [-c <connection>]

Delete local migration source files (does not touch the DB).`;
    case "connection":
      return `Usage:
  ${CLI_NAME} connection list
  ${CLI_NAME} connection add --name ... --endpoint ... --namespace ... --database ... --username ... --password ...
  ${CLI_NAME} connection update <name> [options]

Manage connections without the TUI.`;
    default:
      return usageOverview();
  }
}
