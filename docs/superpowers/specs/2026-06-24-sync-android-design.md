# Design Spec: Cross-Device Sync + Android Build

## Overview

Add cross-device sync via Cloudflare D1 + Workers, and Android APK build support. The sync enables a workflow where changes made on one device (e.g., phone while PC is off) are automatically available when the other device comes online. Activity tracking remains Windows-only.

## Constraints

- Zero VPS cost — Cloudflare free tier only
- Works across different WiFi networks (cloud-hosted)
- Offline-first — local SQLite remains source of truth
- Open source — users provide their own Cloudflare credentials and sync key
- Activity tracking (Windows-specific) does not run on Android

## Decisions Made

- **Conflict resolution:** Last-write-wins by `updated_at` timestamp
- **Sync trigger:** Automatic on every local change + pull on app launch and periodically
- **Authentication:** Shared secret key (user-configurable, entered in settings per device)
- **Android toolchain:** User has Android Studio installed; Tauri-specific NDK config needed

---

## Part 1: Sync Architecture

### Components

1. **Cloudflare Worker** (`sync-worker/`) — thin REST API, ~100 lines
2. **Cloudflare D1 database** — serverless SQLite, same schema as local kanban tables
3. **Sync client** (Rust, in `src-tauri/`) — pushes/pulls changes via HTTP
4. **Settings UI** (React) — sync key + server URL configuration

### What syncs

| Table | Syncs | Reason |
|-------|-------|--------|
| `boards` | Yes | Core kanban data |
| `columns` | Yes | Core kanban data |
| `tasks` | Yes | Core kanban data |
| `tags` | Yes | Core kanban data |
| `task_tags` | Yes | Core kanban data |
| `app_usage` | No | Device-specific activity |
| `browser_usage` | No | Device-specific activity |
| `app_icons` | No | Device-specific activity |

### D1 Schema

Mirrors the local kanban tables exactly. The Worker creates these tables on first deploy:

```sql
CREATE TABLE boards (id TEXT PRIMARY KEY, title TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE columns (id TEXT PRIMARY KEY, board_id TEXT, title TEXT, position REAL, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE tasks (id TEXT PRIMARY KEY, column_id TEXT, title TEXT, description_md TEXT, position REAL, priority TEXT, due_date TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE tags (id TEXT PRIMARY KEY, board_id TEXT, name TEXT, color TEXT, deleted_at TEXT);
CREATE TABLE task_tags (task_id TEXT, tag_id TEXT, PRIMARY KEY(task_id, tag_id));
```

### Sync Protocol

**Endpoint:** `POST /sync`

**Request:**
```json
{
  "last_sync": "2026-06-24T10:00:00Z",
  "changes": {
    "boards": [{ "id": "...", "title": "...", "updated_at": "...", ... }],
    "columns": [...],
    "tasks": [...],
    "tags": [...],
    "task_tags": [...]
  }
}
```

**Response:**
```json
{
  "server_time": "2026-06-24T10:05:00Z",
  "changes": {
    "boards": [...],
    "columns": [...],
    "tasks": [...],
    "tags": [...],
    "task_tags": [...]
  }
}
```

**Worker logic (pseudocode):**
```
1. Validate X-Sync-Key header
2. For each table in incoming changes:
   - For each record: INSERT OR REPLACE into D1
     (last-write-wins: if existing.updated_at >= incoming.updated_at, skip)
3. For each table: SELECT * FROM table WHERE updated_at > last_sync
4. Return server_time + all changes since last_sync
```

### Sync Client (Rust)

**New module:** `src-tauri/src/sync/`

- `client.rs` — HTTP client using `reqwest` (new dependency)
- `changes.rs` — detects local changes since last sync
- `apply.rs` — applies incoming changes to local SQLite

**Sync flow:**
1. On app launch: read `last_sync` from a local `sync_meta` table
2. Collect all local records where `updated_at > last_sync`
3. POST to Worker with changes + `last_sync`
4. Apply response changes to local DB (INSERT OR REPLACE, skip if local is newer)
5. Update `last_sync` to `server_time` from response
6. On every local mutation (create/update/delete): debounce 2s, then trigger sync

**New dependency:** `reqwest` with `rustls` feature (cross-platform HTTP, no OpenSSL needed on Android)

### Settings UI

New settings panel accessible from sidebar or title bar:

- **Sync enabled:** toggle
- **Server URL:** text input (e.g., `https://kough-sync.yourname.workers.dev`)
- **Sync key:** password input (stored in OS keyring via `tauri-plugin-stronghold` or plain config file)
- **Last synced:** timestamp display
- **Sync now:** manual trigger button

### New migration (local)

Add a `sync_meta` table:
```sql
CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT);
-- Stores: last_sync timestamp, server_url, sync_key
```

---

## Part 2: Android Build

### Setup Steps

1. Install Android NDK 26+ via Android Studio SDK Manager
2. Set environment variables: `ANDROID_HOME`, `NDK_HOME`, add to PATH
3. Run `cargo tauri android init`
4. Configure `src-tauri/Cargo.toml` for Android targets
5. Create mobile-specific capabilities file

### Platform Conditionals

**Already handled:**
- `tracker/` module is `#[cfg(windows)]` — excluded on Android
- `get_app_icon` command is `#[cfg(windows)]` — excluded on Android
- `tray-icon` feature needs `#[cfg(desktop)]` guard

**Needs work:**
- `main.rs` entry point needs `#[cfg_attr(mobile, tauri::mobile_entry_point)]` (check if already present)
- Activity view hidden on mobile via platform detection in frontend
- Custom titlebar disabled on mobile (no window chrome)
- Sidebar collapsed by default on mobile (narrow screen)

### Mobile UI Adjustments

- **No custom titlebar on mobile:** use native status bar
- **Board view:** columns scroll horizontally (already does this), but default to single-column on narrow screens
- **Activity view:** hidden entirely on mobile (activity tracking is Windows-only)
- **Sidebar:** hamburger menu or bottom nav on mobile
- **Task detail modal:** full-screen on mobile instead of floating dialog

### Frontend Platform Detection

```typescript
// lib/platform.ts
import { type } from "@tauri-apps/plugin-os";

export const isMobile = () => {
  const os = type();
  return os === "android" || os === "ios";
};
```

### Build Commands

```bash
# Development
cargo tauri android dev

# Production APK
cargo tauri android build --target apk
```

---

## Part 3: File Changes Summary

### New files

| File | Purpose |
|------|---------|
| `sync-worker/worker.js` | Cloudflare Worker sync API |
| `sync-worker/wrangler.toml` | Worker deployment config |
| `sync-worker/schema.sql` | D1 table definitions |
| `src-tauri/src/sync/mod.rs` | Sync module root |
| `src-tauri/src/sync/client.rs` | HTTP sync client |
| `src-tauri/src/sync/changes.rs` | Change detection |
| `src-tauri/src/sync/apply.rs` | Apply incoming changes |
| `src/components/settings/SyncSettings.tsx` | Sync settings UI |
| `src/lib/platform.ts` | Platform detection utility |
| `src-tauri/capabilities/android.json` | Android capabilities |

### Modified files

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `reqwest` dependency, Android config |
| `src-tauri/src/db/migrations.rs` | Add `sync_meta` table migration |
| `src-tauri/src/main.rs` | Register sync commands, mobile entry point |
| `src-tauri/src/lib.rs` | Add sync module, configure for mobile |
| `src-tauri/tauri.conf.json` | Android-specific config |
| `src/components/layout/Sidebar.tsx` | Add settings entry point |
| `src/components/layout/MainContent.tsx` | Platform-conditional views |
| `src/stores/uiStore.ts` | Add settings view state |
| `src/lib/invoke.ts` | Add sync API wrappers |

---

## Part 4: Deployment (User Instructions)

### Cloudflare Setup (one-time)

1. Create free Cloudflare account
2. Install Wrangler CLI: `npm install -g wrangler`
3. `cd sync-worker && wrangler d1 create kough-sync`
4. `wrangler deploy` (creates the Worker)
5. Set the sync key as a Worker secret: `wrangler secret put SYNC_KEY`

### Device Setup

1. Open Kough Settings
2. Enable sync
3. Enter Worker URL (e.g., `https://kough-sync.username.workers.dev`)
4. Enter the same sync key on all devices
5. Done — changes sync automatically
