mod commands;
mod db;
mod error;
mod models;
pub mod sync;
mod tracker;

use db::DbState;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use tauri::WindowEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let conn = db::connection::init_db(app.handle())?;
            app.manage(DbState {
                conn: Mutex::new(conn),
            });

            let tracker_conn = {
                let app_dir = app.path().app_data_dir().map_err(|e| {
                    crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(
                        e.to_string(),
                    ))
                })?;
                let db_path = std::path::PathBuf::from(&app_dir).join("kough.db");
                let conn = rusqlite::Connection::open(&db_path)?;
                conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
                Arc::new(Mutex::new(conn))
            };

            let _tracker_handle = tracker::start_tracker(tracker_conn);

            let show_item = MenuItemBuilder::with_id("show", "Show Kough").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::board::get_boards,
            commands::board::create_board,
            commands::board::update_board,
            commands::board::delete_board,
            commands::column::get_columns_by_board,
            commands::column::create_column,
            commands::column::update_column,
            commands::column::delete_column,
            commands::column::reorder_columns,
            commands::task::get_tasks_by_column,
            commands::task::get_tasks_by_board,
            commands::task::create_task,
            commands::task::update_task,
            commands::task::move_task,
            commands::task::reorder_task,
            commands::task::delete_task,
            commands::tag::get_tags_by_board,
            commands::tag::create_tag,
            commands::tag::update_tag,
            commands::tag::delete_tag,
            commands::tag::get_tags_for_task,
            commands::tag::add_tag_to_task,
            commands::tag::remove_tag_from_task,
            commands::activity::get_app_usage_summary,
            commands::activity::get_browser_usage_summary,
            commands::activity::get_active_tracking,
            commands::activity::get_app_icon,
            commands::trash::get_trash,
            commands::trash::restore_board,
            commands::trash::restore_column,
            commands::trash::restore_task,
            commands::trash::restore_tag,
            commands::trash::purge_old_trash,
            commands::trash::permanently_delete_board,
            commands::trash::permanently_delete_column,
            commands::trash::permanently_delete_task,
            commands::trash::permanently_delete_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
