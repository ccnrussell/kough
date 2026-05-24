use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use super::migrations::run_migrations;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

fn create_backup(db_path: &std::path::Path) -> Result<(), crate::error::AppError> {
    let backup_dir = db_path.parent().unwrap_or(std::path::Path::new(".")).join("backups");
    std::fs::create_dir_all(&backup_dir).map_err(|e| {
        crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;

    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
    let backup_path = backup_dir.join(format!("kough_{}.db", timestamp));

    std::fs::copy(db_path, &backup_path).map_err(|e| {
        crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;

    let mut entries: Vec<_> = std::fs::read_dir(&backup_dir)
        .map_err(|e| crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.file_name().to_string_lossy().starts_with("kough_") &&
            entry.file_name().to_string_lossy().ends_with(".db")
        })
        .collect();

    entries.sort_by_key(|entry| entry.metadata().ok().and_then(|m| m.modified().ok()).unwrap_or(std::time::SystemTime::UNIX_EPOCH));

    if entries.len() > 5 {
        for old in entries.iter().take(entries.len() - 5) {
            let _ = std::fs::remove_file(old.path());
        }
    }

    Ok(())
}

fn one_time_purge(conn: &Connection) -> Result<(), crate::error::AppError> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version >= 1 {
        return Ok(());
    }

    conn.execute(
        "DELETE FROM browser_usage WHERE domain IN (
            SELECT domain FROM browser_usage GROUP BY domain HAVING SUM(total_secs) < 600
        )",
        [],
    )?;

    conn.execute(
        "DELETE FROM app_usage WHERE app_name IN (
            SELECT app_name FROM app_usage GROUP BY app_name HAVING SUM(total_secs) < 600
        )",
        [],
    )?;

    conn.pragma_update(None, "user_version", 1)?;

    Ok(())
}

pub fn init_db(app: &AppHandle) -> Result<Connection, crate::error::AppError> {
    let app_dir = app.path().app_data_dir().map_err(|e| {
        crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;

    std::fs::create_dir_all(&app_dir).map_err(|e| {
        crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;

    let db_path = PathBuf::from(&app_dir).join("kough.db");

    if db_path.exists() {
        create_backup(&db_path)?;
    }

    let conn = Connection::open(&db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    run_migrations(&conn)?;

    crate::db::repository::purge_old_trash(&conn)?;

    one_time_purge(&conn)?;

    Ok(conn)
}
