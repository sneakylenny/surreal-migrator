# surreal-migrator

Interactive SurrealDB migration CLI (menu-first; direct commands coming later).

## Setup

```bash
bun install
```

## Run

```bash
bun start
# or
bun run src/index.ts
```

On first run you choose a migrations directory (default `surreal/`). Connections store endpoint / namespace / database in `surreal.config.json`; usernames and passwords go in `.env` as `SURREAL_<CONNECTION>_<KEY>`.

See [docs/flow.md](docs/flow.md) for the interactive flow.

