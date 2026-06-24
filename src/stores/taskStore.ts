import { create } from "zustand";
import type { Task } from "@/types";
import { api } from "@/lib/invoke";
import { triggerSync } from "@/stores/syncStore";

interface TaskState {
  tasks: Task[];
  loading: boolean;

  fetchTasks: (boardId: string) => Promise<void>;
  createTask: (columnId: string, title: string, priority?: Task["priority"]) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Pick<Task, "title" | "description_md" | "priority" | "due_date">>) => Promise<void>;
  moveTask: (taskId: string, targetColumnId: string, newPosition: number) => Promise<void>;
  reorderTask: (taskId: string, newPosition: number) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  getTasksByColumn: (columnId: string) => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async (boardId: string) => {
    set({ loading: true });
    try {
      const tasks = await api.tasks.listByBoard(boardId);
      tasks.sort((a, b) => a.position - b.position);
      set({ tasks });
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (columnId, title, priority) => {
    const task = await api.tasks.create({ column_id: columnId, title, priority });
    set((s) => ({ tasks: [...s.tasks, task] }));
    triggerSync();
    return task;
  },

  updateTask: async (id, updates) => {
    const payload = { id, ...updates, due_date: updates.due_date ?? undefined };
    const updated = await api.tasks.update(payload);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
    }));
    triggerSync();
  },

  moveTask: async (taskId, targetColumnId, newPosition) => {
    await api.tasks.move({ task_id: taskId, target_column_id: targetColumnId, new_position: newPosition });
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, column_id: targetColumnId, position: newPosition } : t
      ),
    }));
    triggerSync();
  },

  reorderTask: async (taskId, newPosition) => {
    await api.tasks.reorder({ task_id: taskId, new_position: newPosition });
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, position: newPosition } : t
      ),
    }));
    triggerSync();
  },

  deleteTask: async (taskId) => {
    await api.tasks.delete(taskId);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
    triggerSync();
  },

  getTasksByColumn: (columnId: string) => {
    return get()
      .tasks.filter((t) => t.column_id === columnId)
      .sort((a, b) => a.position - b.position);
  },
}));
