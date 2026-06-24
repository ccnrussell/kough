import { create } from "zustand";
import type { Board, Column } from "@/types";
import { api } from "@/lib/invoke";
import { triggerSync } from "@/stores/syncStore";

interface BoardState {
  boards: Board[];
  activeBoardId: string | null;
  columns: Column[];
  loading: boolean;

  fetchBoards: () => Promise<void>;
  createBoard: (title: string) => Promise<Board>;
  updateBoard: (id: string, title: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  setActiveBoard: (id: string) => void;
  fetchColumns: (boardId: string) => Promise<void>;
  createColumn: (boardId: string, title: string) => Promise<void>;
  updateColumn: (id: string, title: string) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  reorderColumn: (columnId: string, newPosition: number) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards: [],
  activeBoardId: null,
  columns: [],
  loading: false,

  fetchBoards: async () => {
    set({ loading: true });
    try {
      const boards = await api.boards.list();
      set({ boards });
      const { activeBoardId } = get();
      if (!activeBoardId && boards.length > 0) {
        set({ activeBoardId: boards[0].id });
        await get().fetchColumns(boards[0].id);
      }
    } finally {
      set({ loading: false });
    }
  },

  createBoard: async (title: string) => {
    const board = await api.boards.create({ title });
    set((s) => ({ boards: [...s.boards, board] }));
    if (!get().activeBoardId) {
      set({ activeBoardId: board.id });
      await get().fetchColumns(board.id);
    }
    triggerSync();
    return board;
  },

  updateBoard: async (id: string, title: string) => {
    await api.boards.update({ id, title });
    set((s) => ({
      boards: s.boards.map((b) => (b.id === id ? { ...b, title } : b)),
    }));
    triggerSync();
  },

  deleteBoard: async (id: string) => {
    await api.boards.delete(id);
    const { boards, activeBoardId } = get();
    const remaining = boards.filter((b) => b.id !== id);
    const newActive = activeBoardId === id
      ? remaining.length > 0 ? remaining[0].id : null
      : activeBoardId;
    set({ boards: remaining, activeBoardId: newActive, columns: newActive ? get().columns : [] });
    if (newActive && newActive !== activeBoardId) {
      await get().fetchColumns(newActive);
    }
    triggerSync();
  },

  setActiveBoard: (id: string) => {
    set({ activeBoardId: id });
    get().fetchColumns(id);
  },

  fetchColumns: async (boardId: string) => {
    const columns = await api.columns.list(boardId);
    columns.sort((a, b) => a.position - b.position);
    set({ columns });
  },

  createColumn: async (boardId: string, title: string) => {
    const col = await api.columns.create({ board_id: boardId, title });
    set((s) => ({ columns: [...s.columns, col] }));
  },

  updateColumn: async (id: string, title: string) => {
    await api.columns.update({ id, title });
    set((s) => ({
      columns: s.columns.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  },

  deleteColumn: async (id: string) => {
    await api.columns.delete(id);
    set((s) => ({ columns: s.columns.filter((c) => c.id !== id) }));
  },

  reorderColumn: async (columnId: string, newPosition: number) => {
    await api.columns.reorder(columnId, newPosition);
    set((s) => ({
      columns: s.columns.map((c) =>
        c.id === columnId ? { ...c, position: newPosition } : c
      ).sort((a, b) => a.position - b.position),
    }));
  },
}));
