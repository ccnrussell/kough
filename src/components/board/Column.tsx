import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal, Plus, Trash2, Pencil } from "lucide-react";
import type { Column as ColumnType } from "@/types";
import { useBoardStore } from "@/stores/boardStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTagStore } from "@/stores/tagStore";
import { useUIStore } from "@/stores/uiStore";
import { TaskCard } from "./TaskCard";
import { AddTaskForm } from "./AddTaskForm";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ColumnProps {
  column: ColumnType;
}

export function Column({ column }: ColumnProps) {
  const { deleteColumn, updateColumn } = useBoardStore();
  const { getTasksByColumn } = useTaskStore();
  const { taskTags, activeTagFilters } = useTagStore();
  const { searchQuery } = useUIStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  let tasks = getTasksByColumn(column.id);

  if (activeTagFilters.size > 0) {
    tasks = tasks.filter((t) => {
      const taskTagList = taskTags[t.id] || [];
      return taskTagList.some((tag) => activeTagFilters.has(tag.id));
    });
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    tasks = tasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.description_md && t.description_md.toLowerCase().includes(q))
    );
  }

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== column.title) {
      updateColumn(column.id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] max-w-[280px] flex flex-col rounded-lg bg-card border transition-colors min-h-0 ${
        isOver ? "border-ring bg-ring/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") setIsEditing(false);
            }}
            className="bg-transparent text-sm font-semibold text-foreground outline-none w-full"
          />
        ) : (
          <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
        )}

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded p-1 hover:bg-accent transition-colors"
          >
            <MoreHorizontal size={14} className="text-muted-foreground" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-6 z-20 w-36 rounded-md border border-border bg-popover p-1 shadow-lg">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <Pencil size={12} /> Rename
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-accent transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2 min-h-[80px]">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
          {tasks.length === 0 && !showAddForm && (
            <div className="flex-1 rounded-md border border-dashed border-border/50 py-8 text-center text-xs text-muted-foreground/60">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>

      <div className="border-t border-border p-2">
        {showAddForm ? (
          <AddTaskForm
            columnId={column.id}
            onClose={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
          >
            <Plus size={14} />
            Add task
          </button>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Column?"
        description={`This will move "${column.title}" and all its tasks to trash. You can restore them within 30 days.`}
        confirmLabel="Delete Column"
        onConfirm={() => deleteColumn(column.id)}
      />
    </div>
  );
}
