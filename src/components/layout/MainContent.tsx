import { useEffect, lazy, Suspense } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTagStore } from "@/stores/tagStore";
import { useUIStore } from "@/stores/uiStore";
import { useActivityStore } from "@/stores/activityStore";
import { Search, X } from "lucide-react";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { Board } from "@/components/board/Board";
import { ActivityView } from "@/components/activity/ActivityView";
import { TrashView } from "@/components/layout/TrashView";
import { TagFilter } from "@/components/tags/TagFilter";

const TaskDetailModal = lazy(() =>
  import("@/components/task/TaskDetailModal").then((m) => ({ default: m.TaskDetailModal }))
);

export function MainContent() {
  const { activeBoardId, fetchBoards } = useBoardStore();
  const { fetchTasks } = useTaskStore();
  const { fetchTags } = useTagStore();
  const { sidebarOpen, taskDetailOpen, activeView, searchQuery, setSearchQuery } = useUIStore();

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (activeBoardId) {
      fetchTasks(activeBoardId);
      fetchTags(activeBoardId);
    }
  }, [activeBoardId, fetchTasks, fetchTags]);

  useEffect(() => {
    if (activeView !== "activity") {
      useActivityStore.getState().clearIconCache();
    }
  }, [activeView]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeView === "board" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <Search size={14} className="flex-shrink-0 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                )}
              </div>
              <TagFilter />
              <Board />
            </div>
          )}
          {activeView === "activity" && <ActivityView />}
          {activeView === "trash" && <TrashView />}
        </main>
      </div>
      {taskDetailOpen && (
        <Suspense>
          <TaskDetailModal />
        </Suspense>
      )}
    </div>
  );
}
