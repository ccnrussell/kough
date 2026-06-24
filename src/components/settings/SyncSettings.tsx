import { useEffect, useState } from "react";
import { useSyncStore } from "@/stores/syncStore";
import { RefreshCw, Cloud, CloudOff } from "lucide-react";

export function SyncSettings() {
  const { settings, syncing, lastResult, lastError, fetchSettings, saveSettings, runSync } = useSyncStore();
  const [enabled, setEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setEnabled(settings.enabled);
    setServerUrl(settings.server_url);
    setSyncKey(settings.sync_key);
  }, [settings]);

  const handleSave = async () => {
    await saveSettings(enabled, serverUrl, syncKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      <div>
        <h2 className="text-lg font-semibold">Sync</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Sync your boards across devices using Cloudflare D1
        </p>
      </div>

      <div className="space-y-4 max-w-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Enable Sync</span>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              enabled ? "bg-primary" : "bg-secondary"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Server URL
          </label>
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="https://kough-sync.username.workers.dev"
            className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">
            Sync Key
          </label>
          <input
            type="password"
            value={syncKey}
            onChange={(e) => setSyncKey(e.target.value)}
            placeholder="Your secret sync key"
            className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {saved ? "Saved!" : "Save Settings"}
          </button>
          <button
            onClick={() => runSync()}
            disabled={syncing || !enabled}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {settings.last_sync && !settings.last_sync.startsWith("1970") && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(settings.last_sync).toLocaleString()}
          </p>
        )}

        {lastError && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <CloudOff size={14} />
            {lastError}
          </div>
        )}

        {lastResult && lastResult.status === "ok" && (
          <div className="flex items-center gap-1.5 text-xs text-green-500">
            <Cloud size={14} />
            Synced — {lastResult.applied} records applied
          </div>
        )}

        {lastResult && lastResult.status === "disabled" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CloudOff size={14} />
            Sync is disabled
          </div>
        )}

        {lastResult && lastResult.status === "not_configured" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CloudOff size={14} />
            Enter server URL and sync key, then save
          </div>
        )}
      </div>
    </div>
  );
}
