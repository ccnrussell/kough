CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, title TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS columns (id TEXT PRIMARY KEY, board_id TEXT, title TEXT, position REAL, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, column_id TEXT, title TEXT, description_md TEXT, position REAL, priority TEXT, due_date TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, board_id TEXT, name TEXT, color TEXT, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS task_tags (task_id TEXT, tag_id TEXT, PRIMARY KEY(task_id, tag_id));
