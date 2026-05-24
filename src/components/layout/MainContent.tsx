import { useEffect } from "react";
import { useBoardStore } from "@/stores/boardStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTagStore } from "@/stores/tagStore";
import { useUIStore } from "@/stores/uiStore";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { Board } from "@/components/board/Board";
import { ActivityView } from "@/components/activity/ActivityView";
import { TrashView } from "@/components/layout/TrashView";
import { TaskDetailModal } from "@/components/task/TaskDetailModal";
import { TagFilter } from "@/components/tags/TagFilter";

export function MainContent() {
  const { activeBoardId, fetchBoards } = useBoardStore();
  const { fetchTasks } = useTaskStore();
  const { fetchTags } = useTagStore();
  const { sidebarOpen, taskDetailOpen, activeView } = useUIStore();

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    if (activeBoardId) {
      fetchTasks(activeBoardId);
      fetchTags(activeBoardId);
    }
  }, [activeBoardId, fetchTasks, fetchTags]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeView === "board" && (
            <>
              <TagFilter />
              <Board />
            </>
          )}
          {activeView === "activity" && <ActivityView />}
          {activeView === "trash" && <TrashView />}
        </main>
      </div>
      {taskDetailOpen && <TaskDetailModal />}
    </div>
  );
}
