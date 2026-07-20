# Surreal Migrator — interactive flow

```mermaid
flowchart TD
  start[CLI start] --> hasConfig{surreal.config.json exists?}
  hasConfig -->|no| setup[Bootstrap default config surreal/]
  setup --> saveConfig["Write config empty connections"]
  hasConfig -->|yes| loadConfig[Load config]
  saveConfig --> connectionsMenu
  loadConfig --> connectionsMenu[Connections list]

  connectionsMenu -->|add| addConn["TUI form: name endpoint creds ns db; format if TS enabled"]
  addConn --> verify[commands/connection/verify]
  verify -->|ok| askDefault{defaultConnection set?}
  verify -->|fail| retryOrContinue{Retry Continue Cancel}
  retryOrContinue -->|retry| addConn
  retryOrContinue -->|continue| askDefault
  retryOrContinue -->|cancel| connectionsMenu
  askDefault -->|no| makeDefault["Ask set as default?"]
  makeDefault --> createCmd[commands/connection/create]
  askDefault -->|yes| createCmd
  createCmd --> connectionsMenu

  connectionsMenu -->|select connection| connectionMenu[Details + pending overview + actions]
  connectionsMenu -->|session activity| sessionLog[In-session event summary]
  sessionLog --> connectionsMenu
  connectionsMenu -->|quit| exitPrint["Print session summary then exit"]

  connectionMenu -->|create migration| createMig["Overlay: kebab-case name"]
  createMig --> writeFiles["Write files under migrationsDir/connection/"]
  writeFiles --> connectionMenu

  connectionMenu -->|migrate| migrateUp["Apply pending ups as one batch"]
  connectionMenu -->|rollback| rollbackMenu[Latest batch / All / Back]
  rollbackMenu -->|batch| rollbackBatch["Down latest batch; skip missing sources"]
  rollbackMenu -->|all| rollbackAll["Down all applied; skip missing sources"]
  rollbackMenu -->|back| connectionMenu

  connectionMenu -->|migration manager| managerList["List: pending / applied / missing source"]
  managerList -->|select pending| pendingMenu["Run this / Migrate to here / Delete files / Back"]
  pendingMenu -->|run this| migrateOne["Apply single migration"]
  pendingMenu -->|migrate to here| migrateThrough["Apply pending through selected inclusive"]
  pendingMenu -->|delete files| deleteFiles["Delete local up/down or .ts files"]
  managerList -->|select applied| appliedMenu["Rollback this / Roll back to here / Back"]
  appliedMenu -->|this| rollbackOne["Down selected only"]
  appliedMenu -->|to here| rollbackAfter["Down migrations after selected"]
  managerList -->|select missing| missingMenu["Delete record / Back"]
  missingMenu -->|delete record| deleteRecord["Delete DB row only no down"]

  connectionMenu -->|edit connection| editConn[Edit form: endpoint creds format default]
  editConn --> connectionMenu
  connectionMenu -->|back| connectionsMenu

  migrateUp --> connectionMenu
  rollbackBatch --> connectionMenu
  rollbackAll --> connectionMenu
  migrateOne --> managerList
  migrateThrough --> managerList
  rollbackAfter --> managerList
  rollbackOne --> managerList
  deleteFiles --> managerList
  deleteRecord --> managerList
  managerList -->|back| connectionMenu
```

## Notes

- **Paths** in the TUI are breadcrumbs (for example `connections / my-db / manager`), not clickable yet.
- **Missing source** means a DB migration record exists without local files. Rollbacks that need those files **skip** them and report what was skipped; use **Delete migration record** only for mismatch cleanup.
- **Delete source files** (pending only) removes local migration files and does not touch the database.
- **Session activity** is in-memory for the current process and is printed on exit when non-empty.
