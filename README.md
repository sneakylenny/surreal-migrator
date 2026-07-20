# Surreal Migrator

**SurrealDB migrator** / **Surreal migration tool** — an interactive CLI for managing SurrealDB schema and data migrations.

![Surreal Migrator Screenshot](https://raw.githubusercontent.com/sneakylenny/surreal-migrator/main/docs/assets/Screenshot%202026-07-17%20at%2014-18-16.png)

A terminal-based CLI for [SurrealDB](https://surrealdb.com) migrations, built on [Bun](https://bun.sh) with [clack](https://www.npmjs.com/package/@clack/prompts) for interactive prompts and the [SurrealDB JavaScript SDK](https://surrealdb.com/docs/reference/javascript) for database operations.

> **Bun only — not Node.js.** The npm package and TypeScript migrations require [Bun](https://bun.sh). This project does not run under Node (`node`, `npm`, `npx`, `pnpm`, or `yarn`). Node users who only need SurQL migrations can use a [prebuilt binary](https://github.com/sneakylenny/surreal-migrator/releases) instead.

> **Note:** The tool is currently menu-first. Direct commands (for example `surreal-migrator migrate`, `surreal-migrator migrate down 20260717100431_add-users` or `surreal-migrator status`) are planned for a later release so you can use it in scripts and CI.

> **AI-assisted.** This package was built with the help of AI.

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

On first run you choose a migrations directory (default `surreal/`). That creates `surreal.config.json`. Add a connection from the menu; credentials are stored in `.env` as `SURREAL_<CONNECTION>_USERNAME` and `SURREAL_<CONNECTION>_PASSWORD`.

## Features

### Connections

Manage multiple SurrealDB targets from one project:

- Add a connection with endpoint, credentials, namespace, database, and migration table
- Optionally choose TypeScript migrations when running via Bun
- Verify the connection and create the migration tracking table
- Pick a default connection (shown first in the list)
- Switch the default later from the connection menu

Each connection has its own migration folder under the migrations directory (for example `surreal/my-connection/`).

### Migration formats

- **Split SurQL** (default) — `.up.surql` and `.down.surql` files. Used when `migrationFormat` is omitted.
- **TypeScript** — a single `.ts` file exporting `up` and `down` functions. Set `"migrationFormat": "ts"` on a connection (Bun / source only).

Released binaries are **SurQL-only**. TypeScript migrations require running via Bun from source.

### Create migrations

From a connection menu, create a new timestamped migration with a kebab-case name. Files are written into that connection’s folder using the connection’s format.

### Migrate

Apply all pending migrations for the current connection in one batch. Applied migrations are recorded in the connection’s migration table with a batch number.

### Rollback

Roll back either:

- the **latest batch** only, or
- **all** applied migrations

### Migration manager

Browse every local migration with an applied or pending status, then act on one at a time:

- **Pending** — confirm and run that migration alone (out-of-order is allowed)
- **Applied** — roll back everything after it (“rollback to here”), or roll back only that migration

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

Omitting `migrationFormat` means SurQL. Set `"migrationFormat": "ts"` on a connection only when using TypeScript migrations. A project-level `migrationFormat` can act as a fallback.

For a diagram of the interactive flow, see [docs/flow.md](docs/flow.md).

Compiled binaries for macOS, Linux, and Windows are also available from [GitHub Releases](https://github.com/sneakylenny/surreal-migrator/releases) (SurQL-only). The npm package requires Bun (not Node.js) and includes TypeScript migration support.

Releases are driven by [Changesets](https://github.com/changesets/changesets): add a changeset in your PR (`bun run changeset`), merge the Version Packages PR that CI opens, and npm + binaries publish automatically.
