# CLI

Direct (non-interactive) commands for scripts and CI. With **no arguments**, `surreal-migrator` opens the interactive TUI instead.

Session activity and the migration manager are TUI-only.

## Connection targeting

Most commands need a connection:

- `-c` / `--connection <name>`, or
- `defaultConnection` in `surreal.config.json`

If neither is set, the command fails.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success, or nothing to do |
| `1` | Validation error, missing connection, or command failure |

## Commands

| Command | Behavior |
|---------|----------|
| `init` | Create `surreal.config.json` and `surreal/` if missing |
| `status` | Print applied / pending / missing-source migrations |
| `create <name>` | Create a new migration (kebab-case name) |
| `up` | Apply all pending migrations (one batch) |
| `up <id>` | Apply only that migration |
| `up --through <id>` | Apply pending through that id (inclusive) |
| `down` | Roll back the **latest batch** only |
| `down --all` | Roll back all applied migrations |
| `down <id>` | Roll back only that migration |
| `down --after <id>` | Roll back migrations after that id |
| `forget <id>` | Delete the DB migration history row only (no down) |
| `delete-files <id>` | Delete local migration source files (no DB change) |
| `connection list` | List connections (marks default) |
| `connection add` | Add a connection (flags required) |
| `connection update <name>` | Update a connection (partial flags) |

Global: `-h` / `--help`.

Mutually exclusive modes error clearly (for example `up <id>` with `--through`, or `down <id>` with `--all`).

### `connection add`

Required:

- `--name`
- `--endpoint`
- `--namespace`
- `--database`
- `--username`
- `--password`

Optional:

- `--table` (default `migration`)
- `--format surql|ts`
- `--default` — set as default connection
- `--skip-verify` — skip connectivity / migration-table check

Verification runs by default before saving.

### `connection update`

Positional: connection name (cannot rename).

Optional flags (omitted fields keep current values / `.env` credentials):

- `--endpoint`, `--namespace`, `--database`, `--username`, `--password`
- `--table`, `--format surql|ts`
- `--default`
- `--skip-verify`

## Examples

```bash
surreal-migrator init
surreal-migrator connection add \
  --name demo \
  --endpoint ws://localhost:8000 \
  --namespace app --database app \
  --username root --password root \
  --default
surreal-migrator create add-users -c demo
surreal-migrator status
surreal-migrator up
surreal-migrator down
surreal-migrator down --all
surreal-migrator up --through 20260720120000_add-users
surreal-migrator forget 20260720120000_old -c demo
```

## Help

```bash
surreal-migrator --help
surreal-migrator help up
```
