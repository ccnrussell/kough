use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::*;

pub fn get_boards(conn: &Connection) -> Result<Vec<board::Board>, AppError> {
    let mut stmt = conn
        .prepare("SELECT id, title, created_at, updated_at FROM boards WHERE deleted_at IS NULL ORDER BY created_at ASC")?;
    let boards = stmt
        .query_map([], |row| {
            Ok(board::Board {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(boards)
}

pub fn create_board(
    conn: &Connection,
    input: &board::CreateBoardInput,
) -> Result<board::Board, AppError> {
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO boards (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params![id, input.title, now],
    )?;

    let default_columns = ["To Do", "In Progress", "Done"];
    for (i, col_title) in default_columns.iter().enumerate() {
        let col_id = Uuid::now_v7().to_string();
        let pos = (i + 1) as f64;
        conn.execute(
            "INSERT INTO columns (id, board_id, title, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![col_id, id, col_title, pos, now],
        )?;
    }

    Ok(board::Board {
        id,
        title: input.title.clone(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_board(
    conn: &Connection,
    input: &board::UpdateBoardInput,
) -> Result<board::Board, AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE boards SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![input.title, now, input.id],
    )?;
    Ok(board::Board {
        id: input.id.clone(),
        title: input.title.clone(),
        created_at: String::new(),
        updated_at: now,
    })
}

pub fn delete_board(conn: &Connection, board_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE boards SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, board_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Board {} not found", board_id)));
    }
    conn.execute(
        "UPDATE columns SET deleted_at = ?1 WHERE board_id = ?2 AND deleted_at IS NULL",
        params![now, board_id],
    )?;
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1 WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?2) AND deleted_at IS NULL",
        params![now, board_id],
    )?;
    Ok(())
}

pub fn get_columns_by_board(
    conn: &Connection,
    board_id: &str,
) -> Result<Vec<column::Column>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, board_id, title, position, created_at, updated_at FROM columns WHERE board_id = ?1 AND deleted_at IS NULL ORDER BY position ASC"
    )?;
    let cols = stmt
        .query_map(params![board_id], |row| {
            Ok(column::Column {
                id: row.get(0)?,
                board_id: row.get(1)?,
                title: row.get(2)?,
                position: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(cols)
}

pub fn create_column(
    conn: &Connection,
    input: &column::CreateColumnInput,
) -> Result<column::Column, AppError> {
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_pos: f64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) FROM columns WHERE board_id = ?1",
        params![input.board_id],
        |row| row.get(0),
    )?;

    let pos = max_pos + 1.0;

    conn.execute(
        "INSERT INTO columns (id, board_id, title, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, input.board_id, input.title, pos, now],
    )?;

    Ok(column::Column {
        id,
        board_id: input.board_id.clone(),
        title: input.title.clone(),
        position: pos,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_column(conn: &Connection, input: &column::UpdateColumnInput) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE columns SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![input.title, now, input.id],
    )?;
    Ok(())
}

pub fn delete_column(conn: &Connection, column_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE columns SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, column_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Column {} not found",
            column_id
        )));
    }
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1 WHERE column_id = ?2 AND deleted_at IS NULL",
        params![now, column_id],
    )?;
    Ok(())
}

pub fn reorder_columns(
    conn: &Connection,
    column_id: &str,
    new_position: f64,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE columns SET position = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_position, now, column_id],
    )?;
    Ok(())
}

pub fn get_tasks_by_column(
    conn: &Connection,
    column_id: &str,
) -> Result<Vec<task::Task>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, column_id, title, description_md, position, priority, due_date, created_at, updated_at FROM tasks WHERE column_id = ?1 AND deleted_at IS NULL ORDER BY position ASC"
    )?;
    let tasks = stmt
        .query_map(params![column_id], |row| {
            Ok(task::Task {
                id: row.get(0)?,
                column_id: row.get(1)?,
                title: row.get(2)?,
                description_md: row.get(3)?,
                position: row.get(4)?,
                priority: row.get(5)?,
                due_date: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tasks)
}

pub fn get_tasks_by_board(conn: &Connection, board_id: &str) -> Result<Vec<task::Task>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.column_id, t.title, t.description_md, t.position, t.priority, t.due_date, t.created_at, t.updated_at
         FROM tasks t
         JOIN columns c ON t.column_id = c.id
         WHERE c.board_id = ?1 AND t.deleted_at IS NULL AND c.deleted_at IS NULL
         ORDER BY t.position ASC"
    )?;
    let tasks = stmt
        .query_map(params![board_id], |row| {
            Ok(task::Task {
                id: row.get(0)?,
                column_id: row.get(1)?,
                title: row.get(2)?,
                description_md: row.get(3)?,
                position: row.get(4)?,
                priority: row.get(5)?,
                due_date: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tasks)
}

pub fn create_task(
    conn: &Connection,
    input: &task::CreateTaskInput,
) -> Result<task::Task, AppError> {
    let id = Uuid::now_v7().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let max_pos: f64 = conn.query_row(
        "SELECT COALESCE(MAX(position), 0) FROM tasks WHERE column_id = ?1",
        params![input.column_id],
        |row| row.get(0),
    )?;
    let pos = max_pos + 1.0;

    let priority = input.priority.as_deref().unwrap_or("medium");
    let desc = input.description_md.as_deref().unwrap_or("");

    conn.execute(
        "INSERT INTO tasks (id, column_id, title, description_md, position, priority, due_date, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![id, input.column_id, input.title, desc, pos, priority, input.due_date, now],
    )?;

    Ok(task::Task {
        id,
        column_id: input.column_id.clone(),
        title: input.title.clone(),
        description_md: desc.to_string(),
        position: pos,
        priority: priority.to_string(),
        due_date: input.due_date.clone(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_task(
    conn: &Connection,
    input: &task::UpdateTaskInput,
) -> Result<task::Task, AppError> {
    let now = chrono::Utc::now().to_rfc3339();

    let existing: task::Task = conn.query_row(
        "SELECT id, column_id, title, description_md, position, priority, due_date, created_at, updated_at FROM tasks WHERE id = ?1",
        params![input.id],
        |row| {
            Ok(task::Task {
                id: row.get(0)?,
                column_id: row.get(1)?,
                title: row.get(2)?,
                description_md: row.get(3)?,
                position: row.get(4)?,
                priority: row.get(5)?,
                due_date: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    ).map_err(|_| AppError::NotFound(format!("Task {} not found", input.id)))?;

    let title = input.title.as_deref().unwrap_or(&existing.title);
    let desc = input
        .description_md
        .as_deref()
        .unwrap_or(&existing.description_md);
    let priority = input.priority.as_deref().unwrap_or(&existing.priority);
    let due_date = input.due_date.as_ref().or(existing.due_date.as_ref());

    conn.execute(
        "UPDATE tasks SET title = ?1, description_md = ?2, priority = ?3, due_date = ?4, updated_at = ?5 WHERE id = ?6",
        params![title, desc, priority, due_date, now, input.id],
    )?;

    Ok(task::Task {
        id: input.id.clone(),
        column_id: existing.column_id,
        title: title.to_string(),
        description_md: desc.to_string(),
        position: existing.position,
        priority: priority.to_string(),
        due_date: due_date.cloned(),
        created_at: existing.created_at,
        updated_at: now,
    })
}

pub fn move_task(
    conn: &Connection,
    task_id: &str,
    target_column_id: &str,
    new_position: f64,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tasks SET column_id = ?1, position = ?2, updated_at = ?3 WHERE id = ?4",
        params![target_column_id, new_position, now, task_id],
    )?;
    Ok(())
}

pub fn reorder_task(conn: &Connection, task_id: &str, new_position: f64) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tasks SET position = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_position, now, task_id],
    )?;
    Ok(())
}

pub fn delete_task(conn: &Connection, task_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE tasks SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, task_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Task {} not found", task_id)));
    }
    Ok(())
}

pub fn get_tags_by_board(conn: &Connection, board_id: &str) -> Result<Vec<tag::Tag>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, board_id, name, color FROM tags WHERE board_id = ?1 AND deleted_at IS NULL ORDER BY name ASC",
    )?;
    let tags = stmt
        .query_map(params![board_id], |row| {
            Ok(tag::Tag {
                id: row.get(0)?,
                board_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

pub fn create_tag(conn: &Connection, input: &tag::CreateTagInput) -> Result<tag::Tag, AppError> {
    let id = Uuid::now_v7().to_string();
    let color = input.color.as_deref().unwrap_or("#6b7280");
    conn.execute(
        "INSERT INTO tags (id, board_id, name, color) VALUES (?1, ?2, ?3, ?4)",
        params![id, input.board_id, input.name, color],
    )?;
    Ok(tag::Tag {
        id,
        board_id: input.board_id.clone(),
        name: input.name.clone(),
        color: color.to_string(),
    })
}

pub fn update_tag(conn: &Connection, input: &tag::UpdateTagInput) -> Result<tag::Tag, AppError> {
    let existing: tag::Tag = conn
        .query_row(
            "SELECT id, board_id, name, color FROM tags WHERE id = ?1",
            params![input.id],
            |row| {
                Ok(tag::Tag {
                    id: row.get(0)?,
                    board_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                })
            },
        )
        .map_err(|_| AppError::NotFound(format!("Tag {} not found", input.id)))?;

    let name = input.name.as_deref().unwrap_or(&existing.name);
    let color = input.color.as_deref().unwrap_or(&existing.color);

    conn.execute(
        "UPDATE tags SET name = ?1, color = ?2 WHERE id = ?3",
        params![name, color, input.id],
    )?;

    Ok(tag::Tag {
        id: input.id.clone(),
        board_id: existing.board_id,
        name: name.to_string(),
        color: color.to_string(),
    })
}

pub fn delete_tag(conn: &Connection, tag_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE tags SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, tag_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Tag {} not found", tag_id)));
    }
    conn.execute(
        "UPDATE task_tags SET deleted_at = ?1, updated_at = ?1 WHERE tag_id = ?2 AND deleted_at IS NULL",
        params![now, tag_id],
    )?;
    Ok(())
}

pub fn get_tags_for_task(conn: &Connection, task_id: &str) -> Result<Vec<tag::Tag>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.board_id, t.name, t.color FROM tags t
         JOIN task_tags tt ON t.id = tt.tag_id
         WHERE tt.task_id = ?1 AND tt.deleted_at IS NULL",
    )?;
    let tags = stmt
        .query_map(params![task_id], |row| {
            Ok(tag::Tag {
                id: row.get(0)?,
                board_id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tags)
}

pub fn add_tag_to_task(conn: &Connection, task_id: &str, tag_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO task_tags (task_id, tag_id, updated_at, deleted_at) VALUES (?1, ?2, ?3, NULL)",
        params![task_id, tag_id, now],
    )?;
    conn.execute(
        "UPDATE task_tags SET deleted_at = NULL, updated_at = ?3 WHERE task_id = ?1 AND tag_id = ?2 AND deleted_at IS NOT NULL",
        params![task_id, tag_id, now],
    )?;
    Ok(())
}

pub fn remove_tag_from_task(
    conn: &Connection,
    task_id: &str,
    tag_id: &str,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE task_tags SET deleted_at = ?3, updated_at = ?3 WHERE task_id = ?1 AND tag_id = ?2 AND deleted_at IS NULL",
        params![task_id, tag_id, now],
    )?;
    Ok(())
}

pub fn get_tasks_by_tag(conn: &Connection, tag_id: &str) -> Result<Vec<task::Task>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.column_id, t.title, t.description_md, t.position, t.priority, t.due_date, t.created_at, t.updated_at
         FROM tasks t
         JOIN task_tags tt ON t.id = tt.task_id
         WHERE tt.tag_id = ?1 AND tt.deleted_at IS NULL
         ORDER BY t.position ASC"
    )?;
    let tasks = stmt
        .query_map(params![tag_id], |row| {
            Ok(task::Task {
                id: row.get(0)?,
                column_id: row.get(1)?,
                title: row.get(2)?,
                description_md: row.get(3)?,
                position: row.get(4)?,
                priority: row.get(5)?,
                due_date: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(tasks)
}

pub fn restore_board(conn: &Connection, board_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE boards SET deleted_at = NULL WHERE id = ?1",
        params![board_id],
    )?;
    conn.execute(
        "UPDATE columns SET deleted_at = NULL WHERE board_id = ?1",
        params![board_id],
    )?;
    conn.execute(
        "UPDATE tasks SET deleted_at = NULL WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?1)",
        params![board_id],
    )?;
    Ok(())
}

pub fn restore_column(conn: &Connection, column_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE columns SET deleted_at = NULL WHERE id = ?1",
        params![column_id],
    )?;
    conn.execute(
        "UPDATE tasks SET deleted_at = NULL WHERE column_id = ?1",
        params![column_id],
    )?;
    Ok(())
}

pub fn restore_task(conn: &Connection, task_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tasks SET deleted_at = NULL WHERE id = ?1",
        params![task_id],
    )?;
    Ok(())
}

pub fn restore_tag(conn: &Connection, tag_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tags SET deleted_at = NULL WHERE id = ?1",
        params![tag_id],
    )?;
    Ok(())
}

pub fn get_trash(conn: &Connection) -> Result<crate::models::trash::TrashData, AppError> {
    let mut boards_stmt = conn.prepare(
        "SELECT id, title, created_at, updated_at FROM boards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let boards = boards_stmt.query_map([], |row| {
        Ok(board::Board {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut cols_stmt = conn.prepare(
        "SELECT id, board_id, title, position, created_at, updated_at FROM columns WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let columns = cols_stmt.query_map([], |row| {
        Ok(column::Column {
            id: row.get(0)?,
            board_id: row.get(1)?,
            title: row.get(2)?,
            position: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut tasks_stmt = conn.prepare(
        "SELECT id, column_id, title, description_md, position, priority, due_date, created_at, updated_at FROM tasks WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let tasks = tasks_stmt.query_map([], |row| {
        Ok(task::Task {
            id: row.get(0)?,
            column_id: row.get(1)?,
            title: row.get(2)?,
            description_md: row.get(3)?,
            position: row.get(4)?,
            priority: row.get(5)?,
            due_date: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut tags_stmt = conn.prepare(
        "SELECT id, board_id, name, color FROM tags WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let tags = tags_stmt.query_map([], |row| {
        Ok(tag::Tag {
            id: row.get(0)?,
            board_id: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(crate::models::trash::TrashData { boards, columns, tasks, tags })
}

pub fn purge_old_trash(conn: &Connection) -> Result<(), AppError> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(30);
    let cutoff_str = cutoff.to_rfc3339();
    conn.execute("DELETE FROM tags WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    conn.execute("DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    conn.execute("DELETE FROM columns WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    conn.execute("DELETE FROM boards WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    Ok(())
}
