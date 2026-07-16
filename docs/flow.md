# Surreal Migrator — interactive flow

```mermaid
flowchart TD
  start[CLI start] --> hasConfig{surreal.config.json exists?}
  hasConfig -->|no| setup[First-time setup]
  setup --> pathPrompt["Migrations dir default: surreal"]
  pathPrompt --> saveConfig["Write config empty connections"]
  hasConfig -->|yes| loadConfig[Load config]
  saveConfig --> connectionsMenu
  loadConfig --> connectionsMenu[Connections list + Add connection]
  connectionsMenu -->|select connection| connectionMenu[Pending migrations overview + actions]
  connectionsMenu -->|add| addConn["Prompt name endpoint user password ns db"]
  addConn --> verify[Connect with surrealdb SDK]
  verify -->|ok| saveConn["Save connection + .env username/password"]
  verify -->|fail| retryOrContinue{Retry or continue?}
  retryOrContinue -->|retry| addConn
  retryOrContinue -->|continue| saveConn
  saveConn --> hasDefault{defaultConnection set?}
  hasDefault -->|no| askDefault["Ask set as default?"]
  askDefault -->|yes| setDefault[Set defaultConnection]
  askDefault -->|no| connectionsMenu
  setDefault --> connectionsMenu
  hasDefault -->|yes| connectionsMenu
  connectionMenu -->|placeholder actions| connectionMenu
  connectionMenu -->|back| connectionsMenu
```
