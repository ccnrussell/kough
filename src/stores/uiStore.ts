import { create } from "zustand";

type ViewType = "board" | "activity" | "trash";

interface UIState {
  sidebarOpen: boolean;
  taskDetailOpen: boolean;
  activeTaskId: string | null;
  editingColumnId: string | null;
  activeView: ViewType;
  searchQuery: string;

  toggleSidebar: () => void;
  openTaskDetail: (taskId: string) => void;
  closeTaskDetail: () => void;
  setEditingColumn: (columnId: string | null) => void;
  setActiveView: (view: ViewType) => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  taskDetailOpen: false,
  activeTaskId: null,
  editingColumnId: null,
  activeView: "board",

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  openTaskDetail: (taskId: string) =>
    set({ taskDetailOpen: true, activeTaskId: taskId }),

  closeTaskDetail: () =>
    set({ taskDetailOpen: false, activeTaskId: null }),

  setEditingColumn: (columnId: string | null) =>
    set({ editingColumnId: columnId }),

  setActiveView: (view: ViewType) =>
    set({ activeView: view }),

  searchQuery: "",
  setSearchQuery: (query: string) => set({ searchQuery: query }),
}));
