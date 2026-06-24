import { create } from "zustand";
import { api } from "@/lib/invoke";
import type { SyncSettings, SyncResult } from "@/types";

interface SyncState {
  settings: SyncSettings;
  syncing: boolean;
  lastResult: SyncResult | null;

  fetchSettings: () => Promise<void>;
  saveSettings: (enabled: boolean, serverUrl: string, syncKey: string) => Promise<void>;
  runSync: () => Promise<SyncResult | null>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  settings: { enabled: false, server_url: "", sync_key: "", last_sync: "" },
  syncing: false,
  lastResult: null,

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
    set({ syncing: true });
    try {
      const result = await api.sync.run();
      set({ lastResult: result });
      if (result.server_time) {
        set({ settings: { ...get().settings, last_sync: result.server_time } });
      }
      return result;
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
