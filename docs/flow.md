# Surreal Migrator — interactive flow

```mermaid
flowchart TD
  start[CLI start] --> hasConfig{surreal.config.json exists?}
  hasConfig -->|no| setup[Bootstrap default config surreal/]
  setup --> saveConfig["Write config empty connections"]
  hasConfig -->|yes| loadConfig[Load config]
  saveConfig --> connectionsMenu
  loadConfig --> connectionsMenu[Connections list + Add connection]
  connectionsMenu -->|select connection| connectionMenu[Pending migrations overview + actions]
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
  connectionMenu -->|create migration| createMig[Create migration]
  createMig --> namePrompt["Prompt kebab-case name"]
  namePrompt --> writeFiles["Write files under migrationsDir/connection/"]
  writeFiles --> connectionMenu
  connectionMenu -->|migrate| migrateUp["Apply pending ups as one batch"]
  connectionMenu -->|rollback| rollbackMenu[Rollback submenu]
  rollbackMenu -->|batch| rollbackBatch["Down latest batch"]
  rollbackMenu -->|all| rollbackAll["Down all applied"]
  rollbackMenu -->|back| connectionMenu
  connectionMenu -->|migration manager| managerList["List local migrations with applied/pending"]
  managerList -->|select pending| pendingMenu["Run this / Migrate to here / Back"]
  pendingMenu -->|run this| migrateOne["Apply single migration"]
  pendingMenu -->|migrate to here| migrateThrough["Apply pending through selected"]
  managerList -->|select applied| appliedMenu["Rollback this / Roll back to here / Back"]
  appliedMenu -->|this| rollbackOne["Down selected migration only"]
  appliedMenu -->|to here| rollbackAfter["Down migrations after selected"]
  migrateUp --> connectionMenu
  rollbackBatch --> connectionMenu
  rollbackAll --> connectionMenu
  migrateOne --> managerList
  migrateThrough --> managerList
  rollbackAfter --> managerList
  rollbackOne --> managerList
  managerList -->|back| connectionMenu
  connectionMenu -->|edit connection| editConn[Edit connection form]
  editConn --> connectionMenu
  connectionMenu -->|back| connectionsMenu
```
