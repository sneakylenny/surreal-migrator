---
"surreal-migrator": minor
---

Rewrite the interactive UI on OpenTUI and add a full direct CLI for scripts and CI (`init`, `status`, `create`, `up`/`down` with targeted modes, `forget`, `delete-files`, `connection add|update|list`). Expand the migration manager (migrate through, roll back to here, delete local files, forget missing-source DB rows), add connection edit/verify with timeout, and session activity logging on TUI exit.
