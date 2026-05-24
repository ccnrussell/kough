use tauri::State;

use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::activity::*;

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_app_usage_summary(
    db: State<'_, DbState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<AppUsageSummary>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_app_usage_summary(&conn, &start_date, &end_date)
}

#[tauri::command]
pub fn get_browser_usage_summary(
    db: State<'_, DbState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<BrowserUsageSummary>, AppError> {
    let conn = lock_conn!(db);
    db::activity_repository::get_browser_usage_summary(&conn, &start_date, &end_date)
}

#[tauri::command]
pub fn get_active_tracking() -> Result<ActiveTracking, AppError> {
    let current = crate::tracker::get_current_tracking();
    match current {
        Some(t) => Ok(ActiveTracking {
            app_name: t.app_name,
            domain: t.domain,
        }),
        None => Ok(ActiveTracking {
            app_name: String::new(),
            domain: None,
        }),
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn get_app_icon(app_name: String) -> Result<String, AppError> {
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_NAME_WIN32, QueryFullProcessImageNameW};
    use windows::Win32::Foundation::{CloseHandle, MAX_PATH};
    use windows::core::PWSTR;
    use windows::Win32::System::ProcessStatus::K32EnumProcesses;

    let mut pids = [0u32; 1024];
    let mut needed = 0u32;
    let result = unsafe { K32EnumProcesses(pids.as_mut_ptr(), (pids.len() * 4) as u32, &mut needed) };
    if !result.as_bool() {
        return Ok(String::new());
    }

    let count = (needed / 4) as usize;
    let target = app_name.to_lowercase().trim_end_matches(".exe").to_string();

    for i in 0..count {
        let pid = pids[i];
        if pid == 0 { continue; }

        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) };
        if let Ok(handle) = handle {
            let mut lpdwsize: u32 = MAX_PATH;
            let mut lpexename_raw: Vec<u16> = vec![0; MAX_PATH as usize];
            let lpexename = PWSTR::from_raw(lpexename_raw.as_mut_ptr());

            let success = unsafe {
                QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, lpexename, &mut lpdwsize).is_ok()
            };

            if success {
                let path = unsafe { lpexename.to_string().unwrap_or_default() };
                let name = std::path::Path::new(&path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                if name == target {
                    unsafe { let _ = CloseHandle(handle); }
                    if let Some(icon) = crate::tracker::icon::extract_icon_from_exe(&path) {
                        return Ok(icon.base64);
                    }
                    return Ok(String::new());
                }
            }

            unsafe { let _ = CloseHandle(handle); }
        }
    }

    Ok(String::new())
}
