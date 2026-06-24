# AGENTS.md — Kough

Cross-platform kanban app built with **Tauri v2** (Rust backend + React frontend). Desktop (Windows) + Android.

**Roadmap**: Sync is implemented via Cloudflare D1. Android build supported. See "Sync" and "Android" sections below.

## Commands

- `npm run tauri dev` — full desktop app with hot reload (not just `npm run dev`, which only starts Vite)
- `npm run build` — frontend only (`tsc && vite build`)
- `npm run tauri build` — production desktop bundle (frontend + Rust)
- `npx tauri android init` — initialize Android project (requires Android Studio + NDK 26+)
- `npx tauri android build --apk -t aarch64` — build signed Android APK
- No test runner, linter, or formatter is configured

## Architecture

```
src/                  # React frontend (Vite entry at src/main.tsx)
  components/
    activity/         # ActivityView, ActivityChart, BrowserDetail, CalendarPicker, SummaryCards
    board/            # TaskCard, Column, Board
    layout/           # Sidebar, MainContent, TitleBar
    settings/         # SyncSettings
    tags/             # Tag management
    task/             # TaskDetailModal, DescriptionEditor (CodeMirror 6)
    ui/               # shadcn/ui primitives
  stores/             # Zustand stores (boardStore, taskStore, tagStore, uiStore, activityStore, syncStore)
  lib/invoke.ts       # typed wrapper around Tauri invoke — all backend calls go here
  lib/platform.ts     # isMobile() for mobile-specific UI
  types/index.ts      # shared TS types mirroring Rust models
src-tauri/            # Rust backend
  src/commands/       # Tauri command handlers (board, column, task, tag, activity, sync)
  src/db/             # SQLite init, migrations, repository layer
  src/models/         # Rust structs (Board, Column, Task, Tag, activity models)
  src/sync/           # sync module (client.rs, changes.rs, apply.rs)
  src/tracker/        # Background activity tracker (tracker.rs, windows.rs, icon.rs)
  src/error.rs        # AppError enum (thiserror + manual Serialize impl)
sync-worker/          # Cloudflare Worker sync API (deploy to Cloudflare free tier)
```

Frontend talks to Rust exclusively through `api.*` in `src/lib/invoke.ts`.

## Key conventions

- **Path alias**: `@/*` maps to `./src/*` (configured in `tsconfig.json` + `vite.config.ts`)
- **UI components**: shadcn/ui (`new-york` style, `rsc: false`, icons from `lucide-react`). Add new ones via the shadcn CLI
- **Styling**: Tailwind CSS v4 — uses `@import "tailwindcss"` in `src/index.css`, not v3 directives
- **Dark mode only**: `<html class="dark">`; custom variant `@custom-variant dark (&:is(.dark *))` in CSS
- **Custom titlebar**: native decorations disabled (`decorations: false`); use `data-tauri-drag-region` for draggable areas
- **Strict TS**: `noUnusedLocals` and `noUnusedParameters` are enabled — dead imports/params will fail `tsc`
- **State**: Zustand stores in `src/stores/`; each store calls `api.*` and manages local cache
- **No comments**: the entire codebase has zero comments — do not add any
- **Platform gating**: Activity tracking is `#[cfg(windows)]` only. Tray/window close is `#[cfg(desktop)]`. Non-Windows stubs for platform-specific commands
- **Mobile UI**: Sidebar is a drawer overlay on mobile (slide-in with backdrop). TitleBar shows hamburger icon, hides window controls

## Backend gotchas

- **Database**: SQLite stored in Tauri's app data dir (`kough.db`), opened with WAL mode and foreign keys ON
- **Migrations**: defined inline in `src-tauri/src/db/migrations.rs` — schema changes go there as new entries in the `MIGRATIONS` array
- **IDs**: UUID v7 generated on the Rust side (crate `uuid` with `v7` feature)
- **Error handling**: `AppError` has a manual `Serialize` impl — adding variants requires updating the match in `error.rs`
- **Lib name**: Cargo lib is named `kough_lib` (not `kough`) to avoid Windows naming conflict; don't rename it
- `src-tauri/src/main.rs` has `windows_subsystem = "windows"` for release builds — do not remove
- **Sync**: Cloudflare D1 + Worker. `tags` table has `updated_at` (migration 7). `task_tags` has no timestamps — full table sync. Non-Windows stub for `get_app_icon` in `commands/activity.rs`

## Activity tracking (Screen Time) — Windows only

Background tracker polls the foreground window every 1 second and aggregates usage per day into two tables: `app_usage` (app_name, date, total_secs) and `browser_usage` (domain, date, total_secs). Flushes to DB every 10 seconds. Entire module is `#[cfg(windows)]` — excluded on Android.

### Browser URL extraction (`src-tauri/src/tracker/windows.rs`)

Uses **UI Automation** (`IUIAutomation` COM API) to read the address bar URL from the foreground browser window. Browser-specific strategies:

- **Firefox**: automation ID `"urlbar-input"`
- **Edge**: automation IDs `"view_1022"` then `"view_1020"`, then falls back to generic Chromium approach
- **Other Chromium** (Chrome, Brave, Opera, Vivaldi, Arc): control type `0xC36E` search (Children then Descendants), then `AccessKey="Ctrl+L"` with control type `0xC354`

COM is initialized per-call (`CoInitializeEx` / `CoUninitialize` with `COINIT_APARTMENTTHREADED`). Domain extraction strips protocol, port, path, and `www.` prefix.

### `windows` crate gotchas

- Version **0.62** with features: `Win32_Foundation`, `Win32_UI_WindowsAndMessaging`, `Win32_System_Threading`, `Win32_System_ProcessStatus`, `Win32_UI_Accessibility`, `Win32_System_Com`, **`Win32_System_Ole`** (required for `VARIANT` + `VariantToStringAlloc`), `Win32_System_Variant`
- `VARIANT` and `VariantToStringAlloc` are gated behind `Win32_System_Ole` in 0.62 — missing this feature causes compile errors
- Read URLs via `GetCurrentPropertyValue(UIA_ValueValuePropertyId)` + `VariantToStringAlloc`, not via `IUIAutomationValuePattern`

### System tray

- App hides to tray on close (via `on_window_event` + `api.prevent_close()`)
- Tray menu: "Show Kough" and "Quit"
- Requires `core:tray:default` and `core:window:allow-hide` in capabilities

### Schema (migration 3)

```
app_usage     (id PK, app_name, date, total_secs)    UNIQUE(app_name, date)
browser_usage (id PK, domain,   date, total_secs)    UNIQUE(domain, date)
```

Old `activity_sessions` data is migrated and table dropped. Kanban tables (`boards`, `columns`, `tasks`, `tags`, `task_tags`) are never touched by activity migrations.

## Markdown editor (CodeMirror 6)

Task descriptions use **CodeMirror 6** with an Obsidian-style **live preview** mode.

- **`src/components/task/DescriptionEditor.tsx`** — React wrapper: creates/destroys `EditorView`, debounced 500ms auto-save to backend, content sync from external changes
- **`src/components/task/livePreview.ts`** — custom `ViewPlugin` decoration layer. On non-active lines, hides markdown syntax markers (`#`, `**`, `*`, backticks, `>`, `~~`, `---`) and applies visual styling (bigger headings, bold, italic, code). On the active line (where cursor is), raw markdown is shown as-is
- **`src/components/task/codemirrorTheme.ts`** — custom dark theme matching existing oklch color palette
- **Task checkboxes** (`- [x]` / `- [ ]`): detected via line-level regex post-pass (not tree-based — lezer doesn't parse `[ ]` as a node). Rendered as clickable checkboxes; clicking toggles `[x]` ↔ `[ ]` in the document
- **CSS**: live preview styling lives in `src/index.css` under `.cm-lp-*` classes
- **Data format**: stored as raw markdown in `description_md` column (SQLite TEXT). CodeMirror reads/writes plain text — no HTML conversion anywhere

### Key dependencies

- `codemirror` (bundles `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`)
- `@codemirror/lang-markdown` (lezer-based markdown parser)

## Sync (Cloudflare D1)

Cross-device sync via Cloudflare D1 + Worker. Free tier (5M reads/day, 100K writes/day, 5GB storage).

### Architecture

- **`sync-worker/`** — Cloudflare Worker (REST API). Validates `X-Sync-Key` header, upserts to D1, returns changes since last sync
- **`src-tauri/src/sync/`** — Rust sync module: `client.rs` (HTTP via reqwest), `changes.rs` (collect local changes), `apply.rs` (apply remote changes)
- **`src-tauri/src/commands/sync.rs`** — Tauri commands: `get_sync_settings`, `save_sync_settings`, `run_sync`
- **`src/stores/syncStore.ts`** — Zustand store, `triggerSync()` debounced helper

### Protocol

1. Collect local changes where `updated_at > last_sync`
2. POST to Worker with `{ last_sync, changes }`
3. Worker upserts to D1 (last-write-wins by `updated_at`)
4. Worker returns all records modified since `last_sync`
5. Apply remote changes to local SQLite
6. Update `last_sync` to server time

`task_tags` has no `updated_at` — always synced as full table. `sync_meta` table stores config (key/value).

### Setup

1. `cd sync-worker && npx wrangler d1 create kough-sync`
2. Update `wrangler.toml` with the returned `database_id`
3. `npx wrangler d1 execute kough-sync --remote --file schema.sql`
4. `npx wrangler secret put SYNC_KEY`
5. `npx wrangler deploy`
6. In Kough: Settings → enter Worker URL + sync key → Enable Sync

## Android

Tauri v2 mobile support. Kanban features are fully cross-platform. Activity tracking is excluded.

### Build

1. Android Studio with NDK 26+ (install via SDK Manager)
2. `npx tauri android init` (one-time)
3. `npx tauri android build --apk -t aarch64`

### Platform detection

- **`src/lib/platform.ts`** — `isMobile()` checks user agent for Android/iOS
- Activity view hidden on mobile (`{activeView === "activity" && !isMobile() && <ActivityView />}`)
- Window controls (min/max/close) hidden on mobile — handled by system

### Desktop-only code

- `src-tauri/src/tracker/` — `#[cfg(windows)]`
- `src-tauri/src/commands/activity.rs` — `get_app_icon` has `#[cfg(windows)]` impl + `#[cfg(not(windows))]` stub returning empty string
- Tray icon and close-to-tray: `#[cfg(desktop)]` in `lib.rs`
- `tauri` crate `tray-icon` feature: conditional in `Cargo.toml` via `[target.'cfg(not(target_os = "android"))'.dependencies]`
