import { create } from "zustand";
import { api } from "@/lib/invoke";
import type { AppUsageSummary, BrowserUsageSummary, ActiveTracking } from "@/types";

interface ActivityState {
  appSummary: AppUsageSummary[];
  browserSummary: BrowserUsageSummary[];
  activeTracking: ActiveTracking | null;
  loading: boolean;
  startDate: string;
  endDate: string;
  iconCache: Record<string, string>;

  fetchAppSummary: () => Promise<void>;
  fetchBrowserSummary: () => Promise<void>;
  fetchActiveTracking: () => Promise<void>;
  setDateRange: (start: string, end: string) => void;
  fetchAppIcon: (appName: string) => Promise<void>;
  clearIconCache: () => void;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

const inflightIcons = new Map<string, Promise<void>>();

export const useActivityStore = create<ActivityState>((set, get) => ({
  appSummary: [],
  browserSummary: [],
  activeTracking: null,
  loading: false,
  startDate: today(),
  endDate: tomorrow(),
  iconCache: {},

  fetchAppSummary: async () => {
    const { startDate, endDate } = get();
    set({ loading: true });
    const appSummary = await api.activity.appSummary(startDate, endDate);
    set({ appSummary, loading: false });
  },

  fetchBrowserSummary: async () => {
    const { startDate, endDate } = get();
    const browserSummary = await api.activity.browserSummary(startDate, endDate);
    set({ browserSummary });
  },

  fetchActiveTracking: async () => {
    const activeTracking = await api.activity.activeTracking();
    set({ activeTracking });
  },

  setDateRange: (start: string, end: string) => {
    set({ startDate: start, endDate: end });
  },

  fetchAppIcon: async (appName: string) => {
    const { iconCache } = get();
    if (iconCache[appName]) return;
    if (inflightIcons.has(appName)) return inflightIcons.get(appName);
    const p = api.activity.getAppIcon(appName).then((iconData) => {
      if (iconData) {
        const { iconCache } = get();
        iconCache[appName] = iconData;
        set({ iconCache: { ...iconCache } });
      }
    }).finally(() => inflightIcons.delete(appName));
    inflightIcons.set(appName, p);
    return p;
  },

  clearIconCache: () => {
    inflightIcons.clear();
    set({ iconCache: {} });
  },
}));
