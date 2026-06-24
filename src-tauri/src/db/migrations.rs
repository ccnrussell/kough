use crate::error::AppError;
use rusqlite::Connection;

const MIGRATIONS: &[&str] = &[
    "
CREATE TABLE IF NOT EXISTS boards (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS columns (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    position    REAL NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    column_id       TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description_md  TEXT NOT NULL DEFAULT '',
    position        REAL NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK(priority IN ('low','medium','high','critical')),
    due_date        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#6b7280'
);

CREATE TABLE IF NOT EXISTS task_tags (
    task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tags_board ON tags(board_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
",
    "
CREATE TABLE IF NOT EXISTS activity_sessions (
    id              TEXT PRIMARY KEY,
    app_name        TEXT NOT NULL,
    app_title       TEXT NOT NULL DEFAULT '',
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    duration_secs   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_activity_app ON activity_sessions(app_name);
CREATE INDEX IF NOT EXISTS idx_activity_started ON activity_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_activity_ended ON activity_sessions(ended_at);
",
    "
CREATE TABLE IF NOT EXISTS app_usage (
    id          TEXT PRIMARY KEY,
    app_name    TEXT NOT NULL,
    date        TEXT NOT NULL,
    total_secs  INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_usage_unique ON app_usage(app_name, date);

CREATE TABLE IF NOT EXISTS browser_usage (
    id          TEXT PRIMARY KEY,
    domain      TEXT NOT NULL,
    date        TEXT NOT NULL,
    total_secs  INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_browser_usage_unique ON browser_usage(domain, date);

INSERT OR IGNORE INTO app_usage (id, app_name, date, total_secs)
SELECT lower(hex(randomblob(16))), app_name, date(started_at), SUM(COALESCE(duration_secs, 0))
FROM activity_sessions
WHERE ended_at IS NOT NULL
GROUP BY app_name, date(started_at);

DROP TABLE IF EXISTS activity_sessions;
",
    "
ALTER TABLE boards ADD COLUMN deleted_at TEXT;
ALTER TABLE columns ADD COLUMN deleted_at TEXT;
ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
ALTER TABLE tags ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_boards_deleted ON boards(deleted_at);
CREATE INDEX IF NOT EXISTS idx_columns_deleted ON columns(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tags_deleted ON tags(deleted_at);
",
    "
ALTER TABLE app_usage ADD COLUMN last_seen TEXT;
ALTER TABLE browser_usage ADD COLUMN last_seen TEXT;

UPDATE app_usage SET last_seen = date || 'T00:00:00Z' WHERE last_seen IS NULL;
UPDATE browser_usage SET last_seen = date || 'T00:00:00Z' WHERE last_seen IS NULL;
",
    "
CREATE INDEX IF NOT EXISTS idx_app_usage_date ON app_usage(date);
CREATE INDEX IF NOT EXISTS idx_browser_usage_date ON browser_usage(date);
CREATE INDEX IF NOT EXISTS idx_app_usage_last_seen ON app_usage(last_seen);
CREATE INDEX IF NOT EXISTS idx_browser_usage_last_seen ON browser_usage(last_seen);

CREATE TABLE IF NOT EXISTS app_icons (
    app_name TEXT PRIMARY KEY,
    icon_data TEXT NOT NULL
);
",
    "
CREATE TABLE IF NOT EXISTS sync_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
",
    "
ALTER TABLE tags ADD COLUMN updated_at TEXT;
UPDATE tags SET updated_at = datetime('now');
",
    "
ALTER TABLE task_tags ADD COLUMN updated_at TEXT;
ALTER TABLE task_tags ADD COLUMN deleted_at TEXT;
UPDATE task_tags SET updated_at = datetime('now');
CREATE INDEX IF NOT EXISTS idx_task_tags_updated_at ON task_tags(updated_at);
CREATE INDEX IF NOT EXISTS idx_task_tags_deleted_at ON task_tags(deleted_at);
",
];

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, AppError> {
    let count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name='{}'", table, column),
        [],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    for (i, sql) in MIGRATIONS.iter().enumerate() {
        if i <= 2 {
            conn.execute_batch(sql).map_err(|e| {
                AppError::Database(rusqlite::Error::InvalidParameterName(format!(
                    "Migration {} failed: {}",
                    i, e
                )))
            })?;
        } else {
            for statement in sql.split(';') {
                let trimmed = statement.trim();
                if trimmed.is_empty() { continue; }
                if trimmed.starts_with("ALTER TABLE") {
                    let parts: Vec<&str> = trimmed.split_whitespace().collect();
                    if parts.len() >= 6 && parts[3] == "ADD" && parts[4] == "COLUMN" {
                        let table = parts[2];
                        let column = parts[5];
                        if column_exists(conn, table, column)? {
                            continue;
                        }
                    }
                }
                conn.execute_batch(trimmed).map_err(|e| {
                    AppError::Database(rusqlite::Error::InvalidParameterName(format!(
                        "Migration {} statement failed: {}",
                        i, e
                    )))
                })?;
            }
        }
    }
    Ok(())
}
