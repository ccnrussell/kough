#[cfg(windows)]
pub mod tracker;
#[cfg(windows)]
pub mod windows;
#[cfg(windows)]
pub mod icon;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;

#[derive(Debug, Clone)]
pub struct CurrentTracking {
    pub app_name: String,
    pub domain: Option<String>,
}

static CURRENT: std::sync::OnceLock<Mutex<Option<CurrentTracking>>> = std::sync::OnceLock::new();

pub fn get_current_tracking() -> Option<CurrentTracking> {
    CURRENT
        .get()
        .and_then(|m| m.lock().ok())
        .and_then(|g| g.clone())
}

pub struct TrackerHandle {
    running: Arc<AtomicBool>,
}

impl TrackerHandle {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

pub fn start_tracker(db_conn: Arc<Mutex<rusqlite::Connection>>) -> TrackerHandle {
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();
    std::thread::spawn(move || {
        #[cfg(windows)]
        tracker::run(db_conn, &running_clone);
    });
    TrackerHandle { running }
}
