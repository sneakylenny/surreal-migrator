# surreal-migrator

## 0.2.2

### Patch Changes

- fe89753: Fix the release workflow by dropping the retired macOS Intel runner that blocked GitHub Releases, and republish platform binaries.

## 0.2.1

### Patch Changes

- 7eb1355: Update README with badges, a full CLI command tree, and side-by-side screenshots; expand the screenshots gallery.

## 0.2.0

### Minor Changes

- 541d21c: Rewrite the interactive UI on OpenTUI and add a full direct CLI for scripts and CI (`init`, `status`, `create`, `up`/`down` with targeted modes, `forget`, `delete-files`, `connection add|update|list`). Expand the migration manager (migrate through, roll back to here, delete local files, forget missing-source DB rows), add connection edit/verify with timeout, and session activity logging on TUI exit.

## 0.1.1

### Patch Changes

- 59b8b6a: Clarify that the npm package requires Bun and is not compatible with Node.js; document SurQL-only binaries as the Node-friendly option; add an AI-assisted development disclaimer.

## 0.1.0

### Minor Changes

- 60dec6b: Initial release of the interactive SurrealDB migration CLI, including connections, SurQL and TypeScript migrations, migrate/rollback, migration manager, and SurQL-only platform binaries.
