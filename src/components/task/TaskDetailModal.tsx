import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTagStore } from "@/stores/tagStore";
import { PRIORITY_CONFIG, type Priority } from "@/types";
import { cn } from "@/lib/utils";
import { DescriptionEditor } from "./DescriptionEditor";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function TaskDetailModal() {
  const { activeTaskId, closeTaskDetail } = useUIStore();
  const { tasks, updateTask, deleteTask } = useTaskStore();
  const { tags, taskTags, addTagToTask, removeTagFromTask } = useTagStore();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const task = tasks.find((t) => t.id === activeTaskId);
  const taskTagList = activeTaskId ? taskTags[activeTaskId] || [] : [];

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setPriority(task.priority);
      setDueDate(task.due_date || "");
    }
  }, [task]);

  if (!task) return null;

  const handleSave = async () => {
    await updateTask(task.id, {
      title: title.trim() || task.title,
      description_md: task.description_md,
      priority,
      due_date: dueDate || null,
    });
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    await deleteTask(task.id);
    closeTaskDetail();
  };

  const handleToggleTag = async (tagId: string) => {
    if (!activeTaskId) return;
    const hasTag = taskTagList.some((t) => t.id === tagId);
    if (hasTag) {
      await removeTagFromTask(activeTaskId, tagId);
    } else {
      await addTagToTask(activeTaskId, tagId);
    }
  };

  const handleDescriptionSave = (markdown: string) => {
    updateTask(task.id, { description_md: markdown });
  };

  return (
    <Dialog open={true} onOpenChange={() => closeTaskDetail()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-card border-border p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="sr-only">Task Detail</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden px-6 pb-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            placeholder="Task title..."
            className="w-full bg-transparent text-xl font-bold text-foreground outline-none placeholder:text-muted-foreground mb-4"
          />

          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Priority:
            </span>
            {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={async () => {
                  setPriority(p);
                  await updateTask(task.id, { priority: p });
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs transition-colors",
                  priority === p
                    ? `${PRIORITY_CONFIG[p].color} text-white`
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                )}
              >
                {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Due:
            </span>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                updateTask(task.id, { due_date: e.target.value || null });
              }}
              className="w-44 bg-secondary border-border text-foreground text-sm"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Tags:
            </span>
            {taskTagList.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{ backgroundColor: `${tag.color}30`, color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={() => handleToggleTag(tag.id)}
                  className="ml-0.5 hover:opacity-70"
                >
                  ×
                </button>
              </span>
            ))}
            {tags
              .filter((t) => !taskTagList.some((tt) => tt.id === t.id))
              .map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  className="rounded-full px-2 py-0.5 text-xs text-muted-foreground border border-dashed border-border hover:bg-accent/50"
                >
                  + {tag.name}
                </button>
              ))}
          </div>

          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Description
          </div>

          <DescriptionEditor
            content={task.description_md}
            onSave={handleDescriptionSave}
          />

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 size={14} className="mr-1" />
              Delete
            </Button>
          </div>
        </div>
        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title="Delete Task?"
          description="This task will be moved to trash. You can restore it within 30 days."
          confirmLabel="Delete Task"
          onConfirm={handleConfirmDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
