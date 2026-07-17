# Surreal Migrator

An interactive CLI for managing [SurrealDB](https://surrealdb.com) schema and data migrations. It walks you through connections, creating migrations, applying them, and rolling them back — all from a terminal menu.

> **Note:** The tool is menu-first today. Direct commands (for example `surreal-migrator migrate` or `surreal-migrator status`) are planned for a later release so you can use it in scripts and CI.

## Requirements

- A reachable SurrealDB instance
- Either:
  - [Bun](https://bun.sh) (development / TypeScript migrations), or
  - A platform binary (SurQL migrations only — no Bun install needed)

## Getting started

With Bun:

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

Compiled binaries for macOS, Linux, and Windows are also available from GitHub Releases (SurQL-only). The npm package requires Bun and includes TypeScript migration support.

Releases are driven by [Changesets](https://github.com/changesets/changesets): add a changeset in your PR (`bun run changeset`), merge the Version Packages PR that CI opens, and npm + binaries publish automatically.
