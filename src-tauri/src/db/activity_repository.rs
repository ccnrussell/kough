use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::activity::*;

pub fn upsert_app_usage(conn: &Connection, app_name: &str, date: &str, secs: i64) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO app_usage (id, app_name, date, total_secs, last_seen) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(app_name, date) DO UPDATE SET total_secs = total_secs + ?4, last_seen = ?5",
        params![Uuid::now_v7().to_string(), app_name, date, secs, now],
    )?;
    Ok(())
}

pub fn upsert_browser_usage(conn: &Connection, domain: &str, date: &str, secs: i64) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO browser_usage (id, domain, date, total_secs, last_seen) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(domain, date) DO UPDATE SET total_secs = total_secs + ?4, last_seen = ?5",
        params![Uuid::now_v7().to_string(), domain, date, secs, now],
    )?;
    Ok(())
}

pub fn cleanup_old_activity(conn: &Connection) -> Result<(), AppError> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(7);
    let cutoff_str = cutoff.to_rfc3339();

    conn.execute(
        "DELETE FROM browser_usage WHERE last_seen < ?1 AND domain IN (
            SELECT domain FROM browser_usage WHERE last_seen < ?1 GROUP BY domain HAVING SUM(total_secs) < 600
        )",
        params![cutoff_str],
    )?;

    conn.execute(
        "DELETE FROM app_usage WHERE last_seen < ?1 AND app_name IN (
            SELECT app_name FROM app_usage WHERE last_seen < ?1 GROUP BY app_name HAVING SUM(total_secs) < 600
        )",
        params![cutoff_str],
    )?;

    conn.execute(
        "DELETE FROM app_icons WHERE app_name NOT IN (SELECT DISTINCT app_name FROM app_usage)",
        [],
    )?;

    Ok(())
}

pub fn get_icon(conn: &Connection, app_name: &str) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare("SELECT icon_data FROM app_icons WHERE app_name = ?1")?;
    let result = stmt.query_row(params![app_name], |row| row.get::<_, String>(0));
    match result {
        Ok(data) => Ok(Some(data)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Database(e)),
    }
}

pub fn save_icon(conn: &Connection, app_name: &str, icon_data: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO app_icons (app_name, icon_data) VALUES (?1, ?2)",
        params![app_name, icon_data],
    )?;
    Ok(())
}

pub fn get_app_usage_summary(conn: &Connection, start_date: &str, end_date: &str) -> Result<Vec<AppUsageSummary>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT app_name, SUM(total_secs) as total_secs
         FROM app_usage
         WHERE date >= ?1 AND date < ?2
         GROUP BY app_name
         ORDER BY total_secs DESC",
    )?;
    let summaries = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(AppUsageSummary {
                app_name: row.get(0)?,
                total_secs: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(summaries)
}

pub fn get_browser_usage_summary(conn: &Connection, start_date: &str, end_date: &str) -> Result<Vec<BrowserUsageSummary>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT domain, SUM(total_secs) as total_secs
         FROM browser_usage
         WHERE date >= ?1 AND date < ?2
         GROUP BY domain
         ORDER BY total_secs DESC",
    )?;
    let summaries = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(BrowserUsageSummary {
                domain: row.get(0)?,
                total_secs: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(summaries)
}
