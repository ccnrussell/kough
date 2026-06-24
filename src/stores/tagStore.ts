import { create } from "zustand";
import type { Tag } from "@/types";
import { api } from "@/lib/invoke";
import { triggerSync } from "@/stores/syncStore";

interface TagState {
  tags: Tag[];
  taskTags: Record<string, Tag[]>;
  activeTagFilters: Set<string>;

  fetchTags: (boardId: string) => Promise<void>;
  createTag: (boardId: string, name: string, color?: string) => Promise<Tag>;
  updateTag: (id: string, updates: Partial<Pick<Tag, "name" | "color">>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  fetchTagsForTask: (taskId: string) => Promise<void>;
  addTagToTask: (taskId: string, tagId: string) => Promise<void>;
  removeTagFromTask: (taskId: string, tagId: string) => Promise<void>;
  toggleTagFilter: (tagId: string) => void;
  clearTagFilters: () => void;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  taskTags: {},
  activeTagFilters: new Set(),

  fetchTags: async (boardId: string) => {
    const tags = await api.tags.list(boardId);
    set({ tags });
  },

  createTag: async (boardId, name, color) => {
    const tag = await api.tags.create({ board_id: boardId, name, color });
    set((s) => ({ tags: [...s.tags, tag] }));
    triggerSync();
    return tag;
  },

  updateTag: async (id, updates) => {
    const updated = await api.tags.update({ id, ...updates });
    set((s) => ({
      tags: s.tags.map((t) => (t.id === id ? updated : t)),
    }));
    triggerSync();
  },

  deleteTag: async (id) => {
    await api.tags.delete(id);
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id),
      activeTagFilters: new Set([...s.activeTagFilters].filter((tid) => tid !== id)),
    }));
    triggerSync();
  },

  fetchTagsForTask: async (taskId: string) => {
    const tags = await api.tags.forTask(taskId);
    set((s) => ({
      taskTags: { ...s.taskTags, [taskId]: tags },
    }));
  },

  addTagToTask: async (taskId, tagId) => {
    await api.tags.addToTask(taskId, tagId);
    const { tags } = get();
    const tag = tags.find((t) => t.id === tagId);
    if (tag) {
      set((s) => ({
        taskTags: {
          ...s.taskTags,
          [taskId]: [...(s.taskTags[taskId] || []), tag],
        },
      }));
    }
    triggerSync();
  },

  removeTagFromTask: async (taskId, tagId) => {
    await api.tags.removeFromTask(taskId, tagId);
    set((s) => ({
      taskTags: {
        ...s.taskTags,
        [taskId]: (s.taskTags[taskId] || []).filter((t) => t.id !== tagId),
      },
    }));
    triggerSync();
  },

  toggleTagFilter: (tagId: string) => {
    set((s) => {
      const next = new Set(s.activeTagFilters);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return { activeTagFilters: next };
    });
  },

  clearTagFilters: () => set({ activeTagFilters: new Set() }),
}));
