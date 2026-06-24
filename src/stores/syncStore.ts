import { create } from "zustand";
import { api } from "@/lib/invoke";
import type { SyncSettings, SyncResult } from "@/types";

interface SyncState {
  settings: SyncSettings;
  syncing: boolean;
  lastResult: SyncResult | null;
  lastError: string | null;

  fetchSettings: () => Promise<void>;
  saveSettings: (enabled: boolean, serverUrl: string, syncKey: string) => Promise<void>;
  runSync: () => Promise<SyncResult | null>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  settings: { enabled: false, server_url: "", sync_key: "", last_sync: "" },
  syncing: false,
  lastResult: null,
  lastError: null,

  fetchSettings: async () => {
    const settings = await api.sync.getSettings();
    set({ settings });
  },

  saveSettings: async (enabled, serverUrl, syncKey) => {
    await api.sync.saveSettings(enabled, serverUrl, syncKey);
    set({
      settings: { ...get().settings, enabled, server_url: serverUrl, sync_key: syncKey },
    });
  },

  runSync: async () => {
    const { syncing } = get();
    if (syncing) return null;
    set({ syncing: true, lastError: null });
    try {
      const result = await api.sync.run();
      set({ lastResult: result });
      if (result.status === "ok" && result.server_time) {
        set({
          settings: { ...get().settings, last_sync: result.server_time },
          lastError: null,
        });
      } else if (result.status === "disabled") {
        set({ lastError: null });
      } else if (result.status === "not_configured") {
        set({ lastError: "Sync not configured. Enter server URL and sync key." });
      }
      return result;
    } catch (e: unknown) {
      let msg: string;
      if (e instanceof Error) {
        msg = e.message;
      } else if (typeof e === "object" && e !== null && "message" in e) {
        msg = String((e as Record<string, unknown>).message);
      } else if (typeof e === "string") {
        msg = e;
      } else {
        msg = JSON.stringify(e);
      }
      set({ lastError: msg, lastResult: null });
      return null;
    } finally {
      set({ syncing: false });
    }
  },
}));

let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const { settings } = useSyncStore.getState();
    if (settings.enabled && settings.server_url && settings.sync_key) {
      useSyncStore.getState().runSync();
    }
  }, 2000);
}
