import { invoke } from "@tauri-apps/api/core";
import type {
  Board, Column, Task, Tag,
  CreateBoardInput, UpdateBoardInput,
  CreateColumnInput, UpdateColumnInput,
  CreateTaskInput, UpdateTaskInput, MoveTaskInput, ReorderTaskInput,
  CreateTagInput, UpdateTagInput,
  AppUsageSummary, BrowserUsageSummary, ActiveTracking, TrashItem,
  SyncSettings, SyncResult,
} from "@/types";

const cmd = <T>(name: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(name, args);

export const api = {
  boards: {
    list: () => cmd<Board[]>("get_boards"),
    create: (input: CreateBoardInput) => cmd<Board>("create_board", { input }),
    update: (input: UpdateBoardInput) => cmd<Board>("update_board", { input }),
    delete: (boardId: string) => cmd<void>("delete_board", { boardId }),
  },
  columns: {
    list: (boardId: string) => cmd<Column[]>("get_columns_by_board", { boardId }),
    create: (input: CreateColumnInput) => cmd<Column>("create_column", { input }),
    update: (input: UpdateColumnInput) => cmd<void>("update_column", { input }),
    delete: (columnId: string) => cmd<void>("delete_column", { columnId }),
    reorder: (columnId: string, newPosition: number) => cmd<void>("reorder_columns", { columnId, newPosition }),
  },
  tasks: {
    listByBoard: (boardId: string) => cmd<Task[]>("get_tasks_by_board", { boardId }),
    listByColumn: (columnId: string) => cmd<Task[]>("get_tasks_by_column", { columnId }),
    create: (input: CreateTaskInput) => cmd<Task>("create_task", { input }),
    update: (input: UpdateTaskInput) => cmd<Task>("update_task", { input }),
    move: (input: MoveTaskInput) => cmd<void>("move_task", { input }),
    reorder: (input: ReorderTaskInput) => cmd<void>("reorder_task", { input }),
    delete: (taskId: string) => cmd<void>("delete_task", { taskId }),
  },
  tags: {
    list: (boardId: string) => cmd<Tag[]>("get_tags_by_board", { boardId }),
    create: (input: CreateTagInput) => cmd<Tag>("create_tag", { input }),
    update: (input: UpdateTagInput) => cmd<Tag>("update_tag", { input }),
    delete: (tagId: string) => cmd<void>("delete_tag", { tagId }),
    forTask: (taskId: string) => cmd<Tag[]>("get_tags_for_task", { taskId }),
    addToTask: (taskId: string, tagId: string) => cmd<void>("add_tag_to_task", { taskId, tagId }),
    removeFromTask: (taskId: string, tagId: string) => cmd<void>("remove_tag_from_task", { taskId, tagId }),
  },
  activity: {
    appSummary: (startDate: string, endDate: string) =>
      cmd<AppUsageSummary[]>("get_app_usage_summary", { startDate, endDate }),
    browserSummary: (startDate: string, endDate: string) =>
      cmd<BrowserUsageSummary[]>("get_browser_usage_summary", { startDate, endDate }),
    activeTracking: () => cmd<ActiveTracking>("get_active_tracking"),
    getAppIcon: (appName: string) => cmd<string>("get_app_icon", { appName }),
  },
  trash: {
    get: () => cmd<TrashItem>("get_trash"),
    restoreBoard: (boardId: string) => cmd<void>("restore_board", { boardId }),
    restoreColumn: (columnId: string) => cmd<void>("restore_column", { columnId }),
    restoreTask: (taskId: string) => cmd<void>("restore_task", { taskId }),
    restoreTag: (tagId: string) => cmd<void>("restore_tag", { tagId }),
    purge: () => cmd<void>("purge_old_trash"),
    permanentlyDeleteBoard: (boardId: string) => cmd<void>("permanently_delete_board", { boardId }),
    permanentlyDeleteColumn: (columnId: string) => cmd<void>("permanently_delete_column", { columnId }),
    permanentlyDeleteTask: (taskId: string) => cmd<void>("permanently_delete_task", { taskId }),
    permanentlyDeleteTag: (tagId: string) => cmd<void>("permanently_delete_tag", { tagId }),
  },
  sync: {
    getSettings: () => cmd<SyncSettings>("get_sync_settings"),
    saveSettings: (enabled: boolean, serverUrl: string, syncKey: string) =>
      cmd<void>("save_sync_settings", { enabled, serverUrl, syncKey }),
    run: () => cmd<SyncResult>("run_sync"),
  },
};
