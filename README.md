# Surreal Migrator

[![npm version](https://img.shields.io/npm/v/surreal-migrator?style=for-the-badge)](https://www.npmjs.com/package/surreal-migrator)
[![CI](https://img.shields.io/github/actions/workflow/status/sneakylenny/surreal-migrator/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/sneakylenny/surreal-migrator/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/sneakylenny/surreal-migrator?style=for-the-badge)](./LICENSE.md)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SurrealDB](https://img.shields.io/badge/SurrealDB-FF00A0?style=for-the-badge&logo=surrealdb&logoColor=white)](https://surrealdb.com)

**SurrealDB migrator** / **Surreal migration tool** — an interactive CLI for managing SurrealDB schema and data migrations.

A terminal-based CLI for [SurrealDB](https://surrealdb.com) migrations, built on [Bun](https://bun.sh) with [OpenTUI](https://opentui.com/) for the interactive UI and the [SurrealDB JavaScript SDK](https://surrealdb.com/docs/reference/javascript) for database operations.

> **Bun only — not Node.js.** The npm package and TypeScript migrations require [Bun](https://bun.sh). This project does not run under Node (`node`, `npm`, `npx`, `pnpm`, or `yarn`). Node users who only need SurQL migrations can use a [prebuilt binary](https://github.com/sneakylenny/surreal-migrator/releases) instead.

> **AI-assisted.** This package was built with the help of AI.

## Screenshots

<table>
  <tr>
    <td align="center" valign="top">
      <strong>Connections list</strong><br />
      <img src="https://raw.githubusercontent.com/sneakylenny/surreal-migrator/main/docs/assets/Screenshot%202026-07-20%20at%2018-29-31.png" alt="Connections list" width="280" />
    </td>
    <td align="center" valign="top">
      <strong>Connection detail</strong><br />
      <img src="https://raw.githubusercontent.com/sneakylenny/surreal-migrator/main/docs/assets/Screenshot%202026-07-20%20at%2018-32-06.png" alt="Connection detail" width="280" />
    </td>
    <td align="center" valign="top">
      <strong>Migration manager</strong><br />
      <img src="https://raw.githubusercontent.com/sneakylenny/surreal-migrator/main/docs/assets/Screenshot%202026-07-20%20at%2018-35-44.png" alt="Migration manager" width="280" />
    </td>
  </tr>
</table>

[More...](https://raw.githubusercontent.com/sneakylenny/surreal-migrator/main/docs/screenshots.md).

## Requirements

- A reachable SurrealDB instance
- Either:
  - [Bun](https://bun.sh) **≥ 1.0** — required for the npm package and TypeScript migrations (**not compatible with Node.js**), or
  - A platform binary from GitHub Releases (SurQL migrations only — no Bun or Node install needed)

## Getting started

With Bun (do not use `npm install -g`):

```bash
bun add -g surreal-migrator
surreal-migrator
```

Or from this repo:

```bash
bun install
bun start
```

On first run the tool creates `surreal.config.json` with migrations directory `surreal/` if it does not already exist. With no arguments the TUI opens on the connections list. Credentials are stored in `.env` as `SURREAL_<CONNECTION>_USERNAME` and `SURREAL_<CONNECTION>_PASSWORD`.

When you quit the TUI (or press Ctrl+C), a short **session activity** summary is printed to the terminal for actions taken during that run.

## Direct commands

With no arguments the TUI opens. For scripts and CI, pass a command instead:

```text
surreal-migrator
├── (no args)                         Open interactive TUI
├── -h, --help                        Show help
├── help [<command>]                  Show help for a command
├── init                              Create surreal.config.json + surreal/ if missing
├── status
│   └── -c, --connection <name>       Target connection (or use defaultConnection)
├── create <name>                     Create a migration (kebab-case name)
│   └── -c, --connection <name>
├── up                                Apply all pending (one batch)
│   ├── <id>                          Apply only that migration
│   ├── --through <id>                Apply pending through id (inclusive)
│   └── -c, --connection <name>
├── down                              Roll back latest batch
│   ├── <id>                          Roll back only that migration
│   ├── --all                         Roll back all applied migrations
│   ├── --after <id>                  Roll back migrations after id
│   └── -c, --connection <name>
├── forget <id>                       Delete DB history row only (no down)
│   └── -c, --connection <name>
├── delete-files <id>                 Delete local source files (no DB change)
│   └── -c, --connection <name>
└── connection
    ├── list                          List connections (marks default)
    ├── add                           Add a connection
    │   ├── --name <name>             Required
    │   ├── --endpoint <url>          Required
    │   ├── --namespace <ns>          Required
    │   ├── --database <db>           Required
    │   ├── --username <user>         Required
    │   ├── --password <pass>         Required
    │   ├── --table <name>            Migration table (default: migration)
    │   ├── --format surql|ts         Migration format
    │   ├── --default                 Set as default connection
    │   └── --skip-verify             Skip connectivity / table check
    └── update <name>                 Update a connection (cannot rename)
        ├── --endpoint <url>
        ├── --namespace <ns>
        ├── --database <db>
        ├── --username <user>
        ├── --password <pass>
        ├── --table <name>
        ├── --format surql|ts
        ├── --default
        └── --skip-verify             Omitted fields keep current values
```

Examples:

```bash
surreal-migrator init
surreal-migrator status -c my-connection
surreal-migrator up
surreal-migrator down          # latest batch
surreal-migrator down --all
surreal-migrator create add-users
```

Use `-c` / `--connection` when no default connection is set. Modes are mutually exclusive (for example `up <id>` with `--through`, or `down <id>` with `--all`). Exit codes: `0` success / nothing to do; `1` error.

Full reference with more examples: [docs/CLI.md](docs/CLI.md).

## Features

### Connections

Manage multiple SurrealDB targets from one project:

- **Add connection** — name, endpoint, credentials, namespace, database, migration table; migration format when TypeScript is available
- Verify connectivity and ensure the migration tracking table exists (retry / continue / cancel on failure)
- Optionally set as the default connection when none is set yet
- **Edit connection** — update endpoint, credentials, format, and default from the connection screen
- Open a connection for details, pending overview, and migration actions

Each connection has its own migration folder under the migrations directory (for example `surreal/my-connection/`).

### Migration formats

- **Split SurQL** (default) — `.up.surql` and `.down.surql` files
- **TypeScript** — a single `.ts` file exporting `up` and `down` functions (Bun / npm package only)

Format is resolved per connection, then project-level `migrationFormat`, then SurQL. Released binaries are **SurQL-only**.

### Create migration

From a connection, enter a kebab-case name. Timestamp-prefixed files are written into that connection’s folder using the resolved format.

### Migrate

Apply all pending migrations for the current connection as **one batch**. Applied rows are stored in the connection’s migration table with a batch number.

### Rollback

From the connection menu:

- **Latest batch** — roll back only the newest batch
- **All** — roll back every applied migration

If a migration’s local source files are missing, that id is **skipped** (with a notice). Other migrations in the same operation still roll back. Missing DB records stay applied until you remove them in the migration manager.

### Migration manager

Browse local and applied migrations with status:

| Status             | Meaning                                        |
| ------------------ | ---------------------------------------------- |
| **pending**        | Local files exist; not applied in the DB       |
| **applied**        | Local files exist and the DB record is present |
| **missing source** | DB record exists; local files are gone         |

**Pending**

- **Run this migration** — apply only that id (out-of-order allowed)
- **Migrate to here** — apply all pending through that id (inclusive), as one batch

**Applied**

- **Rollback this migration** — down only that id
- **Roll back to here** — down everything after that id; selected stays applied

**Missing source**

- **Delete migration record** — remove the DB history row only (no down). For stuck DB/codebase mismatches

### Session activity

From the connections list, **Session activity** shows an in-session log. The same summary is printed when you exit if anything was recorded (opens, creates, migrates, rollbacks, failures, and so on).

### Project layout

Typical files after setup:

```
surreal.config.json   # connections, default connection, migrations dir
.env                  # usernames and passwords (not committed)
surreal/
  <connection>/
    *.up.surql / *.down.surql   # or *.ts when using TypeScript
```

## Configuration

`surreal.config.json` holds non-secret settings. Connection credentials live only in `.env`.

Omitting `migrationFormat` means SurQL. Set `"migrationFormat": "ts"` on a connection (or at project level as a fallback) when using TypeScript migrations.

For a diagram of the interactive flow, see [docs/flow.md](docs/flow.md).

## Releases

Compiled binaries for macOS, Linux, and Windows are available from [GitHub Releases](https://github.com/sneakylenny/surreal-migrator/releases) (SurQL-only). The npm package requires Bun and includes TypeScript migration support.

Releases are driven by [Changesets](https://github.com/changesets/changesets): add a changeset in your PR (`bun run changeset`), merge the Version Packages PR that CI opens, and npm + platform binaries publish automatically.
