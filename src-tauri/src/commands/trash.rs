use tauri::State;
use rusqlite::params;

use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::trash::TrashData;

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_trash(
    db: State<'_, DbState>,
) -> Result<TrashData, AppError> {
    let conn = lock_conn!(db);
    db::repository::get_trash(&conn)
}

#[tauri::command]
pub fn restore_board(db: State<'_, DbState>, board_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_board(&conn, &board_id)
}

#[tauri::command]
pub fn restore_column(db: State<'_, DbState>, column_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_column(&conn, &column_id)
}

#[tauri::command]
pub fn restore_task(db: State<'_, DbState>, task_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_task(&conn, &task_id)
}

#[tauri::command]
pub fn restore_tag(db: State<'_, DbState>, tag_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_tag(&conn, &tag_id)
}

#[tauri::command]
pub fn purge_old_trash(db: State<'_, DbState>) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::purge_old_trash(&conn)
}

#[tauri::command]
pub fn permanently_delete_board(db: State<'_, DbState>, board_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM boards WHERE id = ?1", params![board_id])?;
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_column(db: State<'_, DbState>, column_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM columns WHERE id = ?1", params![column_id])?;
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_task(db: State<'_, DbState>, task_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])?;
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_tag(db: State<'_, DbState>, tag_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM tags WHERE id = ?1", params![tag_id])?;
    Ok(())
}
