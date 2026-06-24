export type Priority = "low" | "medium" | "high" | "critical";

export interface Board {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  column_id: string;
  title: string;
  description_md: string;
  position: number;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface CreateBoardInput {
  title: string;
}

export interface UpdateBoardInput {
  id: string;
  title: string;
}

export interface CreateColumnInput {
  board_id: string;
  title: string;
}

export interface UpdateColumnInput {
  id: string;
  title: string;
}

export interface CreateTaskInput {
  column_id: string;
  title: string;
  description_md?: string;
  priority?: Priority;
  due_date?: string;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  description_md?: string;
  priority?: Priority;
  due_date?: string;
}

export interface MoveTaskInput {
  task_id: string;
  target_column_id: string;
  new_position: number;
}

export interface ReorderTaskInput {
  task_id: string;
  new_position: number;
}

export interface CreateTagInput {
  board_id: string;
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  id: string;
  name?: string;
  color?: string;
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-slate-500" },
  medium: { label: "Medium", color: "bg-blue-500" },
  high: { label: "High", color: "bg-orange-500" },
  critical: { label: "Critical", color: "bg-red-500" },
};

export const DEFAULT_TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#6b7280", "#64748b",
];

export interface AppUsageSummary {
  app_name: string;
  total_secs: number;
}

export interface BrowserUsageSummary {
  domain: string;
  total_secs: number;
}

export interface ActiveTracking {
  app_name: string;
  domain: string | null;
}

export interface TrashItem {
  boards: Board[];
  columns: Column[];
  tasks: Task[];
  tags: Tag[];
}

export interface SyncSettings {
  enabled: boolean;
  server_url: string;
  sync_key: string;
  last_sync: string;
}

export interface SyncResult {
  status: string;
  server_time?: string;
  applied?: number;
}
