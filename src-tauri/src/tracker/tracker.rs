use rusqlite::Connection;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::time::Duration;

use super::windows;
use crate::db::activity_repository;

const FLUSH_INTERVAL_SECS: i64 = 10;
static FLUSH_COUNT: AtomicUsize = AtomicUsize::new(0);

pub fn run(db_conn: Arc<Mutex<Connection>>, running: &AtomicBool) {
    let current_state = super::CURRENT.get_or_init(|| Mutex::new(None));
    let mut current_app: Option<String> = None;
    let mut current_domain: Option<String> = None;
    let mut accumulator_secs: i64 = 0;

    while running.load(Ordering::SeqCst) {
        if let Some(info) = windows::get_foreground_app() {
            let new_domain = if info.is_browser {
                info.browser_url.as_ref().map(|u| windows::extract_domain(u))
            } else {
                None
            };

            let app_changed = current_app.as_ref() != Some(&info.process_name);
            let domain_changed = current_domain != new_domain;

            if app_changed || domain_changed {
                flush_accumulated(&db_conn, &current_app, &current_domain, accumulator_secs);

                current_app = Some(info.process_name.clone());
                current_domain = new_domain;
                accumulator_secs = 0;

                if let Ok(mut state) = current_state.lock() {
                    *state = Some(super::CurrentTracking {
                        app_name: info.process_name,
                        domain: current_domain.clone(),
                    });
                }
            }

            accumulator_secs += 1;

            if accumulator_secs >= FLUSH_INTERVAL_SECS {
                flush_accumulated(&db_conn, &current_app, &current_domain, accumulator_secs);
                accumulator_secs = 0;
            }
        }

        std::thread::sleep(Duration::from_secs(1));
    }

    flush_accumulated(&db_conn, &current_app, &current_domain, accumulator_secs);
}

fn flush_accumulated(
    db_conn: &Arc<Mutex<Connection>>,
    app: &Option<String>,
    domain: &Option<String>,
    secs: i64,
) {
    if secs == 0 {
        return;
    }
    if let Some(ref app_name) = app {
        if let Ok(conn) = db_conn.lock() {
            let date = chrono::Local::now().format("%Y-%m-%d").to_string();
            let _ = activity_repository::upsert_app_usage(&conn, app_name, &date, secs);
            if let Some(ref dom) = domain {
                let _ = activity_repository::upsert_browser_usage(&conn, dom, &date, secs);
            }

            // Run cleanup every ~100 flushes (roughly every ~16 minutes of active use)
            let count = FLUSH_COUNT.fetch_add(1, Ordering::Relaxed);
            if count % 100 == 0 {
                let _ = activity_repository::cleanup_old_activity(&conn);
            }
        }
    }
}
