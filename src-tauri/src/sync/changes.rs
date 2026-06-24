use rusqlite::Connection;
use std::collections::HashMap;

const SYNC_TABLES: &[&str] = &["boards", "columns", "tasks", "tags", "task_tags"];

pub fn collect_changes(
    conn: &Connection,
    since: &str,
) -> Result<HashMap<String, Vec<serde_json::Value>>, String> {
    let mut changes: HashMap<String, Vec<serde_json::Value>> = HashMap::new();

    for table in SYNC_TABLES {
        let (sql, use_param): (String, bool) = if *table == "task_tags" {
            (format!("SELECT * FROM {}", table), false)
        } else {
            (
                format!(
                    "SELECT * FROM {} WHERE updated_at > ?1 OR (deleted_at IS NOT NULL AND deleted_at > ?1)",
                    table
                ),
                true,
            )
        };

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows: Vec<serde_json::Value> = if use_param {
            stmt.query_map(rusqlite::params![since], |row| row_to_json(row))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        } else {
            stmt.query_map([], |row| row_to_json(row))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        };

        if !rows.is_empty() {
            changes.insert(table.to_string(), rows);
        }
    }

    Ok(changes)
}

fn row_to_json(row: &rusqlite::Row) -> rusqlite::Result<serde_json::Value> {
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
}