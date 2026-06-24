# Kough

Cross-platform kanban board with built-in activity tracking. Desktop (Windows) + Android.

![](screenshot.png)

## Features

- Kanban boards with drag-and-drop, tags, priorities, due dates
- Screen time tracking — see which apps and websites you use (Windows only)
- Cross-device sync via Cloudflare D1 — free, no server needed
- Android support — full kanban on your phone

## Installation

**Desktop (Windows):** Download the installer from [Releases](https://github.com/ccaner37/kough/releases).

**Android:** Download the APK from Releases and install it (enable "Install from unknown sources").

## Sync Setup

Sync your boards between devices using Cloudflare D1 (free tier):

1. Create a free [Cloudflare](https://cloudflare.com) account
2. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
3. Create a D1 database: `cd sync-worker && npx wrangler d1 create kough-sync`
4. Copy the `database_id` into `sync-worker/wrangler.toml`
5. Initialize the schema: `npx wrangler d1 execute kough-sync --remote --file schema.sql`
6. Deploy: `npx wrangler deploy`
7. In Kough: Settings → enter Worker URL + a secret key → Enable Sync

## Build from Source

**Prerequisites:** Node.js, Rust, Android Studio (for Android)

```bash
npm install
npm run tauri dev          # desktop dev
npm run tauri build        # desktop production
npx tauri android init     # initialize Android (one-time)
npx tauri android build --apk -t aarch64  # Android APK
```

## Tech Stack

- **Frontend:** React 19, Zustand, Tailwind CSS v4, CodeMirror 6, dnd-kit
- **Backend:** Tauri v2, Rust, SQLite (rusqlite)
- **Sync:** Cloudflare D1 + Workers (serverless, free tier)
