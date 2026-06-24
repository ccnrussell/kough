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
