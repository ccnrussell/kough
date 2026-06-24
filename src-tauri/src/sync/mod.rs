pub mod apply;
pub mod changes;
pub mod client;

use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct SyncState {
    pub server_url: String,
    pub sync_key: String,
    pub last_sync: String,
    pub client: reqwest::Client,
    pub in_flight: Arc<Mutex<bool>>,
}

impl SyncState {
    pub fn new(server_url: String, sync_key: String, last_sync: String) -> Self {
        Self {
            server_url,
            sync_key,
            last_sync,
            client: reqwest::Client::new(),
            in_flight: Arc::new(Mutex::new(false)),
        }
    }
}
