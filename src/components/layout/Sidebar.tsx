import { useState } from "react";
import { Plus, Trash2, Kanban, Clock, Settings } from "lucide-react";
import { useBoardStore } from "@/stores/boardStore";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import { isMobile } from "@/lib/platform";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function Sidebar() {
  const { boards, activeBoardId, createBoard, setActiveBoard, deleteBoard } =
    useBoardStore();
  const { activeView, setActiveView } = useUIStore();
  const [newTitle, setNewTitle] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; boardId: string | null }>({
    open: false,
    boardId: null,
  });

  const handleCreate = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const board = await createBoard(trimmed);
    setNewTitle("");
    setShowInput(false);
    setActiveBoard(board.id);
  };

  return (
    <>
    <div className="flex h-full w-56 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-center gap-1 px-2 pt-3 pb-2">
        <button
          onClick={() => setActiveView("board")}
          title="Board"
          className={cn(
            "rounded-md p-2 transition-colors",
            activeView === "board"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Kanban size={16} />
        </button>
        {!isMobile() && (
        <button
          onClick={() => setActiveView("activity")}
          title="Activity"
          className={cn(
            "rounded-md p-2 transition-colors",
            activeView === "activity"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Clock size={16} />
        </button>
        )}
        <button
          onClick={() => setActiveView("trash")}
          title="Trash"
          className={cn(
            "rounded-md p-2 transition-colors",
            activeView === "trash"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Trash2 size={16} />
        </button>
        <button
          onClick={() => setActiveView("settings")}
          title="Settings"
          className={cn(
            "rounded-md p-2 transition-colors",
            activeView === "settings"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Settings size={16} />
        </button>
      </div>

      {activeView === "board" && (
        <>
          <div className="flex-1 overflow-y-auto px-2">
            {boards.map((board) => (
              <div
                key={board.id}
                className={cn(
                  "group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer text-sm transition-colors",
                  board.id === activeBoardId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={() => setActiveBoard(board.id)}
              >
                <span className="truncate">{board.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete({ open: true, boardId: board.id });
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-2">
            {showInput ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setShowInput(false);
                      setNewTitle("");
                    }
                  }}
                  placeholder="Board name..."
                  className="w-full rounded bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <Plus size={14} />
                New Board
              </button>
            )}
          </div>
        </>
      )}
    </div>
      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, boardId: open ? confirmDelete.boardId : null })}
        title="Delete Board?"
        description={`This will move "${boards.find((b) => b.id === confirmDelete.boardId)?.title || ""}" and all its contents to trash. You can restore it within 30 days.`}
        confirmLabel="Delete Board"
        onConfirm={() => {
          if (confirmDelete.boardId) {
            deleteBoard(confirmDelete.boardId);
          }
        }}
      />
    </>
  );
}
