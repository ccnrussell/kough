import { useState, useEffect } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/lib/invoke";
import type { Board, Column, Task, Tag } from "@/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface TrashData {
  boards: Board[];
  columns: Column[];
  tasks: Task[];
  tags: Tag[];
}

export function TrashView() {
  const [trash, setTrash] = useState<TrashData>({ boards: [], columns: [], tasks: [], tags: [] });
  const [loading, setLoading] = useState(true);
  const [confirmPermDelete, setConfirmPermDelete] = useState<{ open: boolean; id: string; type: string; name: string }>({
    open: false, id: "", type: "", name: "",
  });

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const data = await api.trash.get();
      setTrash({
        boards: data.boards,
        columns: data.columns,
        tasks: data.tasks,
        tags: data.tags,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (type: string, id: string) => {
    try {
      if (type === "board") await api.trash.restoreBoard(id);
      else if (type === "column") await api.trash.restoreColumn(id);
      else if (type === "task") await api.trash.restoreTask(id);
      else if (type === "tag") await api.trash.restoreTag(id);
      await fetchTrash();
    } catch (e) {
      console.error("Restore failed:", e);
    }
  };

  const handlePermanentDelete = async () => {
    const { id, type } = confirmPermDelete;
    try {
      if (type === "board") await api.trash.permanentlyDeleteBoard(id);
      else if (type === "column") await api.trash.permanentlyDeleteColumn(id);
      else if (type === "task") await api.trash.permanentlyDeleteTask(id);
      else if (type === "tag") await api.trash.permanentlyDeleteTag(id);
      await fetchTrash();
    } catch (e) {
      console.error("Permanent delete failed:", e);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const hasItems = trash.boards.length + trash.columns.length + trash.tasks.length + trash.tags.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <h2 className="text-lg font-semibold mb-4">Trash</h2>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : !hasItems ? (
        <div className="text-sm text-muted-foreground">Trash is empty</div>
      ) : (
        <div className="space-y-6">
          {trash.boards.length > 0 && (
            <TrashSection title="Boards" items={trash.boards} type="board" formatDate={formatDate} onRestore={handleRestore} onPermDelete={(id, name) => setConfirmPermDelete({ open: true, id, type: "board", name })} />
          )}
          {trash.columns.length > 0 && (
            <TrashSection title="Columns" items={trash.columns} type="column" formatDate={formatDate} onRestore={handleRestore} onPermDelete={(id, name) => setConfirmPermDelete({ open: true, id, type: "column", name })} />
          )}
          {trash.tasks.length > 0 && (
            <TrashSection title="Tasks" items={trash.tasks} type="task" formatDate={formatDate} onRestore={handleRestore} onPermDelete={(id, name) => setConfirmPermDelete({ open: true, id, type: "task", name })} />
          )}
          {trash.tags.length > 0 && (
            <TrashSection title="Tags" items={trash.tags} type="tag" formatDate={formatDate} onRestore={handleRestore} onPermDelete={(id, name) => setConfirmPermDelete({ open: true, id, type: "tag", name })} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmPermDelete.open}
        onOpenChange={(open) => setConfirmPermDelete({ ...confirmPermDelete, open })}
        title={`Permanently Delete ${confirmPermDelete.type}?`}
        description={`"${confirmPermDelete.name}" will be permanently deleted and cannot be restored.`}
        confirmLabel="Delete Permanently"
        onConfirm={handlePermanentDelete}
      />
    </div>
  );
}

function TrashSection({ title, items, type, formatDate, onRestore, onPermDelete }: {
  title: string;
  items: any[];
  type: string;
  formatDate: (s: string) => string;
  onRestore: (type: string, id: string) => void;
  onPermDelete: (id: string, name: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
            <div>
              <span className="text-sm text-foreground">{item.title ?? item.name ?? item.id}</span>
              <span className="text-xs text-muted-foreground ml-2">Deleted {formatDate(item.updated_at ?? item.created_at ?? "")}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRestore(type, item.id)}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Restore"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => onPermDelete(item.id, item.title ?? item.name ?? item.id)}
                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                title="Delete Permanently"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
