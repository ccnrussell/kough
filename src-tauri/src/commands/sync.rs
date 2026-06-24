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
