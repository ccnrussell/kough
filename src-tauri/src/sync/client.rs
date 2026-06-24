use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use super::SyncState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncPayload {
    pub last_sync: String,
    pub changes: HashMap<String, Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResponse {
    pub server_time: String,
    pub changes: HashMap<String, Vec<serde_json::Value>>,
}

impl SyncState {
    pub async fn push_and_pull(
        &self,
        local_changes: HashMap<String, Vec<serde_json::Value>>,
    ) -> Result<SyncResponse, String> {
        let payload = SyncPayload {
            last_sync: self.last_sync.clone(),
            changes: local_changes,
        };

        let url = format!("{}/sync", self.server_url);
        let resp = self
            .client
            .post(&url)
            .header("X-Sync-Key", &self.sync_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Sync request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Sync failed ({}): {}", status, body));
        }

        resp.json::<SyncResponse>()
            .await
            .map_err(|e| format!("Failed to parse sync response: {}", e))
    }
}
