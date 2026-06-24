# Cross-Device Sync + Android Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cross-device sync via Cloudflare D1 + Workers (free tier, no VPS) and Android APK build support. Activity tracking remains Windows-only.

**Architecture:** Local SQLite stays the source of truth. A Cloudflare Worker acts as a thin sync API backed by D1 (serverless SQLite). Devices push local changes and pull remote changes on every mutation, using last-write-wins conflict resolution by `updated_at` timestamp. A shared secret key authenticates requests. Android build uses Tauri v2 mobile support with platform-gated activity code.

**Tech Stack:** Cloudflare D1 + Workers (sync server), `reqwest` (HTTP client), Tauri v2 mobile (Android), existing SQLite + Zustand stack

---

## Task 1: Create Cloudflare Worker

**Files:**
- Create: `sync-worker/wrangler.toml`
- Create: `sync-worker/schema.sql`
- Create: `sync-worker/worker.js`
- Create: `sync-worker/package.json`

- [ ] **Step 1: Create `sync-worker/package.json`**

```json
{
  "name": "kough-sync-worker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  }
}
```

- [ ] **Step 2: Create `sync-worker/wrangler.toml`**

```toml
name = "kough-sync"
main = "worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "kough-sync"
database_id = "YOUR_D1_DATABASE_ID"
```

- [ ] **Step 3: Create `sync-worker/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, title TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS columns (id TEXT PRIMARY KEY, board_id TEXT, title TEXT, position REAL, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, column_id TEXT, title TEXT, description_md TEXT, position REAL, priority TEXT, due_date TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, board_id TEXT, name TEXT, color TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS task_tags (task_id TEXT, tag_id TEXT, PRIMARY KEY(task_id, tag_id));
```

- [ ] **Step 4: Create `sync-worker/worker.js`**

```javascript
const SYNC_TABLES = ["boards", "columns", "tasks", "tags", "task_tags"];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key",
  };
}

async function handleSync(request, env) {
  const syncKey = request.headers.get("X-Sync-Key");
  if (!syncKey || syncKey !== env.SYNC_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { last_sync, changes } = body;
  const serverTime = new Date().toISOString();

  for (const table of SYNC_TABLES) {
    const rows = changes[table] || [];
    for (const row of rows) {
      const columns = Object.keys(row);
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const updateClauses = columns
        .filter((c) => c !== "id")
        .map((c) => `${c} = excluded.${c}`)
        .join(", ");

      await env.DB.prepare(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updateClauses}
         WHERE excluded.updated_at >= ${table}.updated_at OR ${table}.updated_at IS NULL`
      )
        .bind(...columns.map((c) => row[c]))
        .run();
    }
  }

  const result = {};
  for (const table of SYNC_TABLES) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ${table} WHERE updated_at > ?1 OR (updated_at IS NULL AND deleted_at > ?1)`
    )
      .bind(last_sync)
      .all();
    result[table] = results || [];
  }

  return new Response(JSON.stringify({ server_time: serverTime, changes: result }), {
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      const response = await handleSync(request, env);
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(headers)) {
        newHeaders.set(k, v);
      }
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers });
  },
};
```

- [ ] **Step 5: Verify Worker structure**

Run: `ls sync-worker/`
Expected: `package.json`, `wrangler.toml`, `schema.sql`, `worker.js`

- [ ] **Step 6: Commit**

```bash
git add sync-worker/
git commit -m "feat: add Cloudflare Worker sync API"
```

---

## Task 2: Add sync_meta migration

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

- [ ] **Step 1: Add migration 6 to `migrations.rs`**

Append to the `MIGRATIONS` array (after the `app_icons` table migration at index 5):

```rust
    "
CREATE TABLE IF NOT EXISTS sync_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
",
```

The array should now have 7 entries (indices 0-6). The new migration uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times. Since it's a `CREATE TABLE` (not `ALTER TABLE`), it will be handled by the `i <= 2` branch in `run_migrations` — but since the index is now 6, it goes through the `else` branch. This is fine because `CREATE TABLE IF NOT EXISTS` is idempotent and doesn't need the `ALTER TABLE` column-existence check.

- [ ] **Step 2: Verify migration compiles**

Run: `cd src-tauri && cargo check 2>&1 | head -20`
Expected: no errors related to migrations

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/migrations.rs
git commit -m "feat: add sync_meta table migration"
```

---

## Task 3: Add reqwest dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add reqwest to `[dependencies]`**

In `src-tauri/Cargo.toml`, add after the `base64 = "0.22"` line:

```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tokio = { version = "1", features = ["sync"] }
```

`rustls-tls` avoids OpenSSL dependency (critical for Android cross-compilation). `default-features = false` removes the native-tls feature. `tokio` with `sync` feature provides `Mutex` for the sync state.

- [ ] **Step 2: Verify it resolves**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: `Finished` with no errors (may show warnings)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add reqwest for sync HTTP client"
```

---

## Task 4: Create sync module — client.rs

**Files:**
- Create: `src-tauri/src/sync/mod.rs`
- Create: `src-tauri/src/sync/client.rs`

- [ ] **Step 1: Create `src-tauri/src/sync/mod.rs`**

```rust
pub mod client;

use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct SyncState {
    pub server_url: String,
    pub sync_key: String,
    pub last_sync: String,
    pub client: reqwest::Client,
    pub in_flight: Arc<Mutex<bool>>,
}

impl SyncState {
    pub fn new(server_url: String, sync_key: String, last_sync: String) -> Self {
        Self {
            server_url,
            sync_key,
            last_sync,
            client: reqwest::Client::new(),
            in_flight: Arc::new(Mutex::new(false)),
        }
    }
}
```

- [ ] **Step 2: Create `src-tauri/src/sync/client.rs`**

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::SyncState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncPayload {
    pub last_sync: String,
    pub changes: HashMap<String, Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResponse {
    pub server_time: String,
    pub changes: HashMap<String, Vec<serde_json::Value>>,
}

const SYNC_TABLES: &[&str] = &["boards", "columns", "tasks", "tags", "task_tags"];

impl SyncState {
    pub async fn push_and_pull(
        &self,
        local_changes: HashMap<String, Vec<serde_json::Value>>,
    ) -> Result<SyncResponse, String> {
        let payload = SyncPayload {
            last_sync: self.last_sync.clone(),
            changes: local_changes,
        };

        let url = format!("{}/sync", self.server_url);
        let resp = self
            .client
            .post(&url)
            .header("X-Sync-Key", &self.sync_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Sync request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Sync failed ({}): {}", status, body));
        }

        resp.json::<SyncResponse>()
            .await
            .map_err(|e| format!("Failed to parse sync response: {}", e))
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/sync/
git commit -m "feat: add sync module with HTTP client"
```

---

## Task 5: Create sync module — changes.rs

**Files:**
- Create: `src-tauri/src/sync/changes.rs`

- [ ] **Step 1: Create `src-tauri/src/sync/changes.rs`**

```rust
use rusqlite::Connection;
use std::collections::HashMap;

const SYNC_TABLES: &[&str] = &["boards", "columns", "tasks", "tags", "task_tags"];

pub fn collect_changes(
    conn: &Connection,
    since: &str,
) -> Result<HashMap<String, Vec<serde_json::Value>>, String> {
    let mut changes: HashMap<String, Vec<serde_json::Value>> = HashMap::new();

    for table in SYNC_TABLES {
        let sql = format!(
            "SELECT * FROM {} WHERE updated_at > ?1 OR (deleted_at IS NOT NULL AND deleted_at > ?1)",
            table
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows: Vec<serde_json::Value> = stmt
            .query_map(rusqlite::params![since], |row| {
                let mut map = serde_json::Map::new();
                for i in 0..row.as_ref().column_count() {
                    let name = row.as_ref().column_name(i).unwrap_or("unknown").to_string();
                    let value: rusqlite::types::Value = row.get(i).unwrap_or(rusqlite::types::Value::Null);
                    let json_value = match value {
                        rusqlite::types::Value::Null => serde_json::Value::Null,
                        rusqlite::types::Value::Integer(n) => serde_json::Value::Number(n.into()),
                        rusqlite::types::Value::Real(f) => {
                            serde_json::Number::from_f64(f)
                                .map(serde_json::Value::Number)
                                .unwrap_or(serde_json::Value::Null)
                        }
                        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                        rusqlite::types::Value::Blob(b) => {
                            serde_json::Value::String(base64::Engine::encode(
                                &base64::engine::general_purpose::STANDARD,
                                &b,
                            ))
                        }
                    };
                    map.insert(name, json_value);
                }
                Ok(serde_json::Value::Object(map))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        if !rows.is_empty() {
            changes.insert(table.to_string(), rows);
        }
    }

    Ok(changes)
}
```

- [ ] **Step 2: Register module in `src-tauri/src/sync/mod.rs`**

Add at the top of `mod.rs`:

```rust
pub mod changes;
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/sync/changes.rs src-tauri/src/sync/mod.rs
git commit -m "feat: add local change detection for sync"
```

---

## Task 6: Create sync module — apply.rs

**Files:**
- Create: `src-tauri/src/sync/apply.rs`

- [ ] **Step 1: Create `src-tauri/src/sync/apply.rs`**

```rust
use rusqlite::Connection;
use std::collections::HashMap;

const SYNC_TABLES: &[&str] = &["boards", "columns", "tasks", "tags", "task_tags"];

pub fn apply_changes(
    conn: &Connection,
    changes: &HashMap<String, Vec<serde_json::Value>>,
) -> Result<u32, String> {
    let mut applied = 0u32;

    for table in SYNC_TABLES {
        let rows = match changes.get(*table) {
            Some(r) => r,
            None => continue,
        };

        for row in rows {
            let obj = match row.as_object() {
                Some(o) => o,
                None => continue,
            };

            let columns: Vec<&str> = obj.keys().map(|s| s.as_str()).collect();
            let placeholders: Vec<String> = (0..columns.len()).map(|i| format!("?{}", i + 1)).collect();

            let update_clauses: Vec<String> = columns
                .iter()
                .filter(|&&c| c != "id")
                .map(|c| format!("{} = excluded.{}", c, c))
                .collect();

            let sql = format!(
                "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT(id) DO UPDATE SET {} WHERE excluded.updated_at >= {}.updated_at OR {}.updated_at IS NULL",
                table,
                columns.join(", "),
                placeholders.join(", "),
                update_clauses.join(", "),
                table,
                table
            );

            let values: Vec<rusqlite::types::Value> = columns
                .iter()
                .map(|&c| {
                    let v = obj.get(c).unwrap_or(&serde_json::Value::Null);
                    match v {
                        serde_json::Value::Null => rusqlite::types::Value::Null,
                        serde_json::Value::Number(n) => {
                            if let Some(i) = n.as_i64() {
                                rusqlite::types::Value::Integer(i)
                            } else if let Some(f) = n.as_f64() {
                                rusqlite::types::Value::Real(f)
                            } else {
                                rusqlite::types::Value::Null
                            }
                        }
                        serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                        _ => rusqlite::types::Value::Text(v.to_string()),
                    }
                })
                .collect();

            conn.execute(&sql, rusqlite::params_from_iter(values.iter()))
                .map_err(|e| format!("Failed to apply {} row: {}", table, e))?;
            applied += 1;
        }
    }

    Ok(applied)
}
```

- [ ] **Step 2: Register module in `src-tauri/src/sync/mod.rs`**

Add alongside the other module declarations:

```rust
pub mod apply;
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/sync/apply.rs src-tauri/src/sync/mod.rs
git commit -m "feat: add incoming change application for sync"
```

---

## Task 7: Add sync Tauri commands

**Files:**
- Create: `src-tauri/src/commands/sync.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create `src-tauri/src/commands/sync.rs`**

```rust
use rusqlite::params;
use tauri::State;

use crate::db::DbState;
use crate::error::AppError;
use crate::sync::SyncState;

#[derive(serde::Serialize, Clone)]
pub struct SyncSettings {
    pub enabled: bool,
    pub server_url: String,
    pub sync_key: String,
    pub last_sync: String,
}

fn read_meta(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM sync_meta WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .ok()
}

fn write_meta(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

#[tauri::command]
pub fn get_sync_settings(db: State<'_, DbState>) -> Result<SyncSettings, AppError> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;
    Ok(SyncSettings {
        enabled: read_meta(&conn, "sync_enabled").unwrap_or_default() == "true",
        server_url: read_meta(&conn, "server_url").unwrap_or_default(),
        sync_key: read_meta(&conn, "sync_key").unwrap_or_default(),
        last_sync: read_meta(&conn, "last_sync").unwrap_or_default(),
    })
}

#[tauri::command]
pub fn save_sync_settings(
    db: State<'_, DbState>,
    enabled: bool,
    server_url: String,
    sync_key: String,
) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;
    write_meta(&conn, "sync_enabled", &enabled.to_string())?;
    write_meta(&conn, "server_url", &server_url)?;
    write_meta(&conn, "sync_key", &sync_key)?;
    if read_meta(&conn, "last_sync").is_none() {
        write_meta(&conn, "last_sync", "1970-01-01T00:00:00Z")?;
    }
    Ok(())
}

#[tauri::command]
pub async fn run_sync(db: State<'_, DbState>) -> Result<serde_json::Value, AppError> {
    let (server_url, sync_key, last_sync) = {
        let conn = db.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        let enabled = read_meta(&conn, "sync_enabled").unwrap_or_default() == "true";
        if !enabled {
            return Ok(serde_json::json!({ "status": "disabled" }));
        }
        let url = read_meta(&conn, "server_url").unwrap_or_default();
        let key = read_meta(&conn, "sync_key").unwrap_or_default();
        let last = read_meta(&conn, "last_sync").unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());
        if url.is_empty() || key.is_empty() {
            return Ok(serde_json::json!({ "status": "not_configured" }));
        }
        (url, key, last)
    };

    let local_changes = {
        let conn = db.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        crate::sync::changes::collect_changes(&conn, &last_sync)
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e)))?
    };

    let sync_state = SyncState::new(server_url, sync_key, last_sync.clone());
    let response = sync_state.push_and_pull(local_changes).await
        .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e)))?;

    let applied = {
        let conn = db.conn.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        let count = crate::sync::apply::apply_changes(&conn, &response.changes)
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e)))?;
        write_meta(&conn, "last_sync", &response.server_time)?;
        count
    };

    Ok(serde_json::json!({
        "status": "ok",
        "server_time": response.server_time,
        "applied": applied,
    }))
}
```

- [ ] **Step 2: Add sync commands module to `lib.rs`**

In `src-tauri/src/lib.rs`, add `mod sync;` after the existing module declarations (line 5). Then add the sync commands to the `invoke_handler`:

```rust
            commands::sync::get_sync_settings,
            commands::sync::save_sync_settings,
            commands::sync::run_sync,
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check 2>&1 | tail -10`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/sync.rs src-tauri/src/lib.rs
git commit -m "feat: add sync Tauri commands (settings, run_sync)"
```

---

## Task 8: Add sync API wrappers to invoke.ts

**Files:**
- Modify: `src/lib/invoke.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add sync types to `src/types/index.ts`**

Append at the end of the file:

```typescript
interface SyncSettings {
  enabled: boolean;
  server_url: string;
  sync_key: string;
  last_sync: string;
}

interface SyncResult {
  status: string;
  server_time?: string;
  applied?: number;
}
```

- [ ] **Step 2: Add sync API section to `invoke.ts`**

Add the import for `SyncSettings, SyncResult` to the existing import statement, then add the sync section to the `api` object:

```typescript
  sync: {
    getSettings: () => cmd<SyncSettings>("get_sync_settings"),
    saveSettings: (enabled: boolean, serverUrl: string, syncKey: string) =>
      cmd<void>("save_sync_settings", { enabled, serverUrl, syncKey }),
    run: () => cmd<SyncResult>("run_sync"),
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -20`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/invoke.ts src/types/index.ts
git commit -m "feat: add sync API wrappers and types"
```

---

## Task 9: Create sync store

**Files:**
- Create: `src/stores/syncStore.ts`

- [ ] **Step 1: Create `src/stores/syncStore.ts`**

```typescript
import { create } from "zustand";
import { api } from "@/lib/invoke";
import type { SyncSettings, SyncResult } from "@/types";

interface SyncState {
  settings: SyncSettings;
  syncing: boolean;
  lastResult: SyncResult | null;

  fetchSettings: () => Promise<void>;
  saveSettings: (enabled: boolean, serverUrl: string, syncKey: string) => Promise<void>;
  runSync: () => Promise<SyncResult | null>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  settings: { enabled: false, server_url: "", sync_key: "", last_sync: "" },
  syncing: false,
  lastResult: null,

  fetchSettings: async () => {
    const settings = await api.sync.getSettings();
    set({ settings });
  },

  saveSettings: async (enabled, serverUrl, syncKey) => {
    await api.sync.saveSettings(enabled, serverUrl, syncKey);
    set({
      settings: { ...get().settings, enabled, server_url: serverUrl, sync_key: syncKey },
    });
  },

  runSync: async () => {
    const { syncing } = get();
    if (syncing) return null;
    set({ syncing: true });
    try {
      const result = await api.sync.run();
      set({ lastResult: result });
      if (result.server_time) {
        set({ settings: { ...get().settings, last_sync: result.server_time } });
      }
      return result;
    } finally {
      set({ syncing: false });
    }
  },
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -20`
Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add src/stores/syncStore.ts
git commit -m "feat: add sync Zustand store"
```

---

## Task 10: Create SyncSettings UI

**Files:**
- Create: `src/components/settings/SyncSettings.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/stores/uiStore.ts`
- Modify: `src/components/layout/MainContent.tsx`

- [ ] **Step 1: Create `src/components/settings/SyncSettings.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useSyncStore } from "@/stores/syncStore";
import { RefreshCw, Cloud, CloudOff } from "lucide-react";

export function SyncSettings() {
  const { settings, syncing, lastResult, fetchSettings, saveSettings, runSync } = useSyncStore();
  const [enabled, setEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setEnabled(settings.enabled);
    setServerUrl(settings.server_url);
    setSyncKey(settings.sync_key);
  }, [settings]);

  const handleSave = async () => {
    await saveSettings(enabled, serverUrl, syncKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      <div>
        <h2 className="text-lg font-semibold">Sync</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sync your boards across devices using Cloudflare D1
        </p>
      </div>

      <div className="space-y-4 max-w-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Enable Sync</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              enabled ? "bg-primary" : "bg-secondary"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Server URL
          </label>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://kough-sync.username.workers.dev"
            className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Sync Key
          </label>
          <input
            type="password"
            value={syncKey}
            onChange={(e) => setSyncKey(e.target.value)}
            placeholder="Your secret sync key"
            className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {saved ? "Saved!" : "Save Settings"}
          </button>
          <button
            onClick={() => runSync()}
            disabled={syncing || !enabled}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {settings.last_sync && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(settings.last_sync).toLocaleString()}
          </p>
        )}

        {lastResult && lastResult.status === "ok" && (
          <div className="flex items-center gap-1.5 text-xs text-green-500">
            <Cloud size={14} />
            Synced — {lastResult.applied} records applied
          </div>
        )}

        {lastResult && lastResult.status === "disabled" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CloudOff size={14} />
            Sync is disabled
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add "settings" view type to `uiStore.ts`**

In `src/stores/uiStore.ts`, change the `ViewType` and add to the store:

```typescript
type ViewType = "board" | "activity" | "trash" | "settings";
```

- [ ] **Step 3: Add Settings button to Sidebar**

In `src/components/layout/Sidebar.tsx`, import `Settings` from lucide-react and add a settings button in the button group (after the Trash button, before the closing `</div>` on line 68):

```tsx
import { Plus, Trash2, Kanban, Clock, Settings } from "lucide-react";
```

Add after the Trash button:

```tsx
        <button
          onClick={() => setActiveView("settings")}
          title="Settings"
          className={cn(
            "rounded-md p-2 transition-colors",
            activeView === "settings"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Settings size={16} />
        </button>
```

- [ ] **Step 4: Add settings view to MainContent**

In `src/components/layout/MainContent.tsx`, import `SyncSettings` and add the view condition:

```tsx
import { SyncSettings } from "@/components/settings/SyncSettings";
```

Add after the trash view condition:

```tsx
          {activeView === "settings" && <SyncSettings />}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -20`
Expected: no type errors

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/SyncSettings.tsx src/stores/uiStore.ts src/components/layout/Sidebar.tsx src/components/layout/MainContent.tsx
git commit -m "feat: add sync settings UI"
```

---

## Task 11: Add automatic sync triggers

**Files:**
- Modify: `src/stores/boardStore.ts`
- Modify: `src/stores/taskStore.ts`
- Modify: `src/stores/tagStore.ts`
- Modify: `src/components/layout/MainContent.tsx`

- [ ] **Step 1: Add sync trigger helper to `src/stores/syncStore.ts`**

Add a debounced sync function and export it:

```typescript
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const { settings } = useSyncStore.getState();
    if (settings.enabled && settings.server_url && settings.sync_key) {
      useSyncStore.getState().runSync();
    }
  }, 2000);
}
```

- [ ] **Step 2: Add sync triggers to `boardStore.ts`**

Import `triggerSync` at the top of `src/stores/boardStore.ts`:

```typescript
import { triggerSync } from "@/stores/syncStore";
```

Add `triggerSync()` call at the end of these actions (after the `set()` call):
- `createBoard` — after `set({ boards: [...s.boards, board] })`
- `updateBoard` — after `set({ boards: s.boards.map(...) })`
- `deleteBoard` — after `set({ boards: s.boards.filter(...) })`
- `restoreBoard` — after restoring (if applicable)

- [ ] **Step 3: Add sync triggers to `taskStore.ts`**

Import `triggerSync` at the top of `src/stores/taskStore.ts`:

```typescript
import { triggerSync } from "@/stores/syncStore";
```

Add `triggerSync()` call at the end of:
- `createTask`
- `updateTask`
- `moveTask`
- `reorderTask`
- `deleteTask`

- [ ] **Step 4: Add sync triggers to `tagStore.ts`**

Import `triggerSync` at the top of `src/stores/tagStore.ts`:

```typescript
import { triggerSync } from "@/stores/syncStore";
```

Add `triggerSync()` call at the end of:
- `createTag`
- `updateTag`
- `deleteTag`
- `addTagToTask`
- `removeTagFromTask`

- [ ] **Step 5: Add sync on app launch in `MainContent.tsx`**

Import `useSyncStore` and add a useEffect that runs sync on mount:

```tsx
import { useSyncStore } from "@/stores/syncStore";
```

Add inside the `MainContent` component:

```tsx
  const { fetchSettings, runSync } = useSyncStore();

  useEffect(() => {
    fetchSettings().then(() => {
      runSync();
    });
  }, [fetchSettings, runSync]);
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -20`
Expected: no type errors

- [ ] **Step 7: Commit**

```bash
git add src/stores/boardStore.ts src/stores/taskStore.ts src/stores/tagStore.ts src/stores/syncStore.ts src/components/layout/MainContent.tsx
git commit -m "feat: add automatic sync triggers on mutations and app launch"
```

---

## Task 12: Android project initialization

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/capabilities/android.json` (after init)
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Install Tauri Android CLI**

Run: `cargo install tauri-cli --version "^2"`

- [ ] **Step 2: Initialize Android project**

Run: `cd src-tauri && cargo tauri android init`

This generates `src-tauri/gen/android/` with the Android project structure.

- [ ] **Step 3: Guard tray-icon feature for desktop only**

In `src-tauri/Cargo.toml`, change the tauri dependency to conditionally enable tray-icon:

```toml
[dependencies]
tauri = { version = "2", features = [] }
```

Then in `src-tauri/src/lib.rs`, gate the tray setup behind `#[cfg(desktop)]`:

```rust
#[cfg(desktop)]
{
    let show_item = MenuItemBuilder::with_id("show", "Show Kough").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show_item, &quit_item])
        .build()?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    if let Some(window) = app.get_webview_window("main") {
        let win = window.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = win.hide();
            }
        });
    }
}
```

- [ ] **Step 4: Guard window close behavior for desktop**

The window close prevention (hide to tray) should also be desktop-only. It's included in the `#[cfg(desktop)]` block above.

- [ ] **Step 5: Verify Rust compiles for desktop**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/gen/android/
git commit -m "feat: initialize Android project and gate desktop-only code"
```

---

## Task 13: Platform detection and mobile UI

**Files:**
- Create: `src/lib/platform.ts`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/MainContent.tsx`

- [ ] **Step 1: Create `src/lib/platform.ts`**

```typescript
let mobileOverride: boolean | null = null;

export function isMobile(): boolean {
  if (mobileOverride !== null) return mobileOverride;
  const ua = navigator.userAgent;
  return /android|iphone|ipad|ipod/i.test(ua);
}

export function setMobileOverride(value: boolean) {
  mobileOverride = value;
}
```

- [ ] **Step 2: Hide Activity view button on mobile in Sidebar**

In `src/components/layout/Sidebar.tsx`, import `isMobile` and conditionally render the Activity button:

```tsx
import { isMobile } from "@/lib/platform";
```

Wrap the Activity button (lines 44-55) with:

```tsx
{!isMobile() && (
  <button onClick={() => setActiveView("activity")} ... >
    <Clock size={16} />
  </button>
)}
```

- [ ] **Step 3: Hide ActivityView on mobile in MainContent**

In `src/components/layout/MainContent.tsx`, import `isMobile` and guard the Activity view:

```tsx
import { isMobile } from "@/lib/platform";
```

Change line 58 from:
```tsx
{activeView === "activity" && <ActivityView />}
```
to:
```tsx
{activeView === "activity" && !isMobile() && <ActivityView />}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -20`
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform.ts src/components/layout/Sidebar.tsx src/components/layout/MainContent.tsx
git commit -m "feat: add platform detection and hide activity view on mobile"
```

---

## Task 14: Android build and test

- [ ] **Step 1: Set up Android environment variables**

Ensure `ANDROID_HOME`, `NDK_HOME` are set. The NDK version should be 26+ (check Tauri docs for exact requirement).

Run: `echo $ANDROID_HOME && echo $NDK_HOME`
Expected: paths to Android SDK and NDK

- [ ] **Step 2: Build debug APK**

Run: `cargo tauri android dev`
Expected: app launches in Android emulator or connected device

- [ ] **Step 3: Test kanban functionality on Android**

- Create a board
- Add columns and tasks
- Edit a task
- Verify activity tab is not visible
- Verify sync settings work

- [ ] **Step 4: Build release APK**

Run: `cargo tauri android build --target apk`
Expected: APK file in `src-tauri/gen/android/app/build/outputs/apk/`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Android build support with mobile UI adjustments"
```

---

## Task 15: End-to-end sync test

- [ ] **Step 1: Deploy Cloudflare Worker**

```bash
cd sync-worker
# Edit wrangler.toml: set YOUR_D1_DATABASE_ID
wrangler d1 create kough-sync  # note the ID, put in wrangler.toml
wrangler deploy
wrangler secret put SYNC_KEY  # enter your secret key
```

- [ ] **Step 2: Configure sync on Device A**

- Open Kough on desktop
- Go to Settings
- Enable sync
- Enter Worker URL and sync key
- Create a board with some tasks

- [ ] **Step 3: Configure sync on Device B**

- Open Kough on another device (or Android emulator)
- Go to Settings
- Enter same Worker URL and sync key
- Verify the board from Device A appears

- [ ] **Step 4: Test offline workflow**

- Turn off Device A
- On Device B, create a new task
- Turn on Device A
- Verify the new task appears on Device A

- [ ] **Step 5: Test conflict resolution**

- On both devices (while both are online), edit the same task title differently
- Trigger sync
- Verify last-write-wins: the change with the later `updated_at` wins

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: complete cross-device sync and Android build"
```
