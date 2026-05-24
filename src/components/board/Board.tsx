import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useBoardStore } from "@/stores/boardStore";
import { useTaskStore } from "@/stores/taskStore";
import { Column } from "./Column";
import { generateFractionalIndex } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { Task } from "@/types";

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCorners(args);
};

export function Board() {
  const { columns, activeBoardId, createColumn } = useBoardStore();
  const { tasks, moveTask, getTasksByColumn } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [newColTitle, setNewColTitle] = useState("");
  const [showColInput, setShowColInput] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const getColumnForTask = useCallback(
    (taskId: string) => {
      const t = tasks.find((t) => t.id === taskId);
      return t ? t.column_id : null;
    },
    [tasks]
  );

  const getColumnForDroppable = useCallback(
    (droppableId: string) => {
      if (columns.find((c) => c.id === droppableId)) return droppableId;
      const t = tasks.find((t) => t.id === droppableId);
      return t ? t.column_id : null;
    },
    [columns, tasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeCol = getColumnForTask(activeId);
    const overCol = getColumnForDroppable(overId);
    if (!activeCol || !overCol) return;

    if (activeCol !== overCol) {
      const colTasks = getTasksByColumn(overCol);
      const overIdx = colTasks.findIndex((t) => t.id === overId);

      let newPos: number;
      if (overIdx >= 0) {
        const beforePos = overIdx > 0 ? colTasks[overIdx - 1].position : null;
        const afterPos = colTasks[overIdx].position;
        newPos = generateFractionalIndex(beforePos, afterPos);
      } else {
        const lastPos = colTasks.length > 0 ? colTasks[colTasks.length - 1].position : null;
        newPos = generateFractionalIndex(lastPos, null);
      }

      moveTask(activeId, overCol, newPos);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activeCol = getColumnForTask(activeId);
    const overCol = getColumnForDroppable(overId);
    if (!activeCol || !overCol) return;

    if (activeCol === overCol) {
      const colTasks = getTasksByColumn(overCol);
      const overIdx = colTasks.findIndex((t) => t.id === overId);

      if (overIdx >= 0) {
        const activeIdx = colTasks.findIndex((t) => t.id === activeId);
        if (activeIdx === overIdx) return;
      }

      const activeIdx = colTasks.findIndex((t) => t.id === activeId);
      let newPos: number;

      if (overIdx < 0) {
        const lastPos = colTasks.length > 0 ? colTasks[colTasks.length - 1].position : null;
        newPos = generateFractionalIndex(lastPos, null);
      } else if (activeIdx < overIdx) {
        const afterPos = colTasks[overIdx].position;
        const beforePos = overIdx > 0 ? colTasks[overIdx - 1].position : null;
        newPos = generateFractionalIndex(beforePos, afterPos);
      } else {
        const beforePos = overIdx > 0 ? colTasks[overIdx - 1].position : null;
        const afterPos = colTasks[overIdx].position;
        newPos = generateFractionalIndex(beforePos, afterPos);
      }

      moveTask(activeId, overCol, newPos);
    }
  };

  const handleAddColumn = async () => {
    const trimmed = newColTitle.trim();
    if (!trimmed || !activeBoardId) return;
    await createColumn(activeBoardId, trimmed);
    setNewColTitle("");
    setShowColInput(false);
  };

  if (!activeBoardId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-lg">Create a board to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {columns.map((col) => (
          <Column key={col.id} column={col} />
        ))}

        <div className="min-w-[280px]">
          {showColInput ? (
            <div className="rounded-lg border border-border bg-card p-3">
              <input
                autoFocus
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn();
                  if (e.key === "Escape") {
                    setShowColInput(false);
                    setNewColTitle("");
                  }
                }}
                placeholder="Column title..."
                className="w-full rounded bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowColInput(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent/30 transition-colors"
            >
              <Plus size={16} />
              Add Column
            </button>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="rounded-md border border-border bg-background p-3 shadow-2xl ring-2 ring-ring/30 rotate-1 scale-[1.02] cursor-grabbing">
            <div className="min-w-0">
              <div className="flex items-start gap-2 mb-1">
                <span
                  className={`inline-block mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                    activeTask.priority === "low"
                      ? "bg-slate-500"
                      : activeTask.priority === "medium"
                      ? "bg-blue-500"
                      : activeTask.priority === "high"
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }`}
                />
                <p className="text-sm font-medium text-foreground break-words">
                  {activeTask.title}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
