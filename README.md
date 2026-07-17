# Surreal Migrator

An interactive CLI for managing [SurrealDB](https://surrealdb.com) schema and data migrations. It walks you through connections, creating migrations, applying them, and rolling them back — all from a terminal menu.

> **Note:** The tool is menu-first today. Direct commands (for example `surreal-migrator migrate` or `surreal-migrator status`) are planned for a later release so you can use it in scripts and CI.

## Requirements

- [Bun](https://bun.sh)
- A reachable SurrealDB instance

## Getting started

```bash
bun install
bun start
```

On first run you choose a migrations directory (default `surreal/`). That creates `surreal.config.json`. Add a connection from the menu; credentials are stored in `.env` as `SURREAL_<CONNECTION>_USERNAME` and `SURREAL_<CONNECTION>_PASSWORD`.

## Features

### Connections

Manage multiple SurrealDB targets from one project:

- Add a connection with endpoint, credentials, namespace, database, migration table, and migration format
- Verify the connection and create the migration tracking table
- Pick a default connection (shown first in the list)
- Switch the default later from the connection menu

Each connection has its own migration folder under the migrations directory (for example `surreal/my-connection/`).

### Migration formats

Per connection you can choose:

- **Split SurQL** — `.up.surql` and `.down.surql` files
- **TypeScript** — a single `.ts` file exporting `up` and `down` functions

That makes it easy to keep separate SurQL and TypeScript connections for testing or different environments.

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
<database folder>/
  <connection>/
    *.up.surql / *.down.surql   # or
    *.ts
```

## Configuration

`surreal.config.json` holds non-secret settings. Connection credentials live only in `.env`.

You can set a project-level `migrationFormat` as a fallback; each connection may override it with its own `migrationFormat`.

For a diagram of the interactive flow, see [docs/flow.md](docs/flow.md).
