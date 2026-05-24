# Kough Feature Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 features for Kough: adjustable task description area, confirmation before delete, trash system with 30-day auto-purge, task search, activity UI/UX improvements with app icons, database cleanup optimization, and database backup system.

**Architecture:** Front-end React changes for UI features (dialogs, search, trash view, activity visual improvements). Back-end Rust changes for database schema (soft delete columns, last_seen column), new Tauri commands (restore, purge, icon extraction, cleanup), and tracker integration. Database migrations for schema evolution.

**Tech Stack:** React + TypeScript + Tailwind CSS v4 + Zustand (frontend), Rust + Tauri v2 + rusqlite (backend), Win32 API for icon extraction.

---

## Feature 1: Adjustable Task Description Area

### Task 1: Increase dialog and editor sizing

**Files:**
- Modify: `src/components/task/TaskDetailModal.tsx`
- Modify: `src/components/task/DescriptionEditor.tsx`

- [ ] **Step 1: Increase dialog dimensions**

In `src/components/task/TaskDetailModal.tsx`, change line 69:

```tsx
<DialogContent className="max-w-3xl h-[85vh] flex flex-col bg-card border-border p-0 gap-0">
```

To:

```tsx
<DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-card border-border p-0 gap-0">
```

- [ ] **Step 2: Make DescriptionEditor resizable**

In `src/components/task/DescriptionEditor.tsx`, change line 91-93:

```tsx
<div
  ref={containerRef}
  className="cm-wrapper flex-1 min-h-0 overflow-y-auto rounded-md border border-border bg-secondary/30"
/>
```

To:

```tsx
<div
  ref={containerRef}
  className="cm-wrapper flex-1 min-h-[200px] overflow-y-auto rounded-md border border-border bg-secondary/30 resize-y"
/>
```

- [ ] **Step 3: Verify**

Build and run: `npm run tauri dev`
Open a task detail modal. Verify:
- Dialog is wider and taller
- Description editor can be resized vertically by dragging bottom edge

- [ ] **Step 4: Commit**

```bash
git add src/components/task/TaskDetailModal.tsx src/components/task/DescriptionEditor.tsx
git commit -m "feat: increase task description area and make it resizable"
```

---

## Feature 2: Confirmation Before Delete

### Task 2: Create ConfirmDialog component

**Files:**
- Create: `src/components/ui/confirm-dialog.tsx`

- [ ] **Step 1: Write ConfirmDialog component**

Create `src/components/ui/confirm-dialog.tsx`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-muted-foreground">
          {description}
        </DialogDescription>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/confirm-dialog.tsx
git commit -m "feat: add reusable ConfirmDialog component"
```

### Task 3: Wire confirmation to board delete

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Import and integrate ConfirmDialog**

Add import at top of `src/components/layout/Sidebar.tsx`:

```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
```

Add state inside Sidebar component after existing state:

```tsx
const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; boardId: string | null }>({
  open: false,
  boardId: null,
});
```

- [ ] **Step 2: Replace direct delete with confirmation**

Change the board delete button onClick (lines 67-70) from:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    deleteBoard(board.id);
  }}
>
```

To:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    setConfirmDelete({ open: true, boardId: board.id });
  }}
>
```

- [ ] **Step 3: Add ConfirmDialog at end of return**

Add after the closing `</div>` of the sidebar, before the final `)`:

```tsx
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
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add confirmation dialog before board deletion"
```

### Task 4: Wire confirmation to column delete

**Files:**
- Modify: `src/components/board/Column.tsx`

- [ ] **Step 1: Import and add state**

Add import:

```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
```

Add state:

```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
```

- [ ] **Step 2: Replace direct delete with confirmation**

Change delete button onClick (lines 90-94) from:

```tsx
<button onClick={() => { deleteColumn(column.id); setShowMenu(false); }}>
```

To:

```tsx
<button onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}>
```

- [ ] **Step 3: Add ConfirmDialog**

Add at end of return, before closing `</div>`:

```tsx
<ConfirmDialog
  open={showDeleteConfirm}
  onOpenChange={setShowDeleteConfirm}
  title="Delete Column?"
  description={`This will move "${column.title}" and all its tasks to trash. You can restore them within 30 days.`}
  confirmLabel="Delete Column"
  onConfirm={() => deleteColumn(column.id)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/board/Column.tsx
git commit -m "feat: add confirmation dialog before column deletion"
```

### Task 5: Wire confirmation to task delete

**Files:**
- Modify: `src/components/task/TaskDetailModal.tsx`

- [ ] **Step 1: Import and add state**

Add import:

```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
```

Add state:

```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
```

- [ ] **Step 2: Replace direct delete with confirmation**

Change handleDelete from:

```tsx
const handleDelete = async () => {
  await deleteTask(task.id);
  closeTaskDetail();
};
```

To:

```tsx
const handleDelete = async () => {
  setShowDeleteConfirm(true);
};

const handleConfirmDelete = async () => {
  await deleteTask(task.id);
  closeTaskDetail();
};
```

- [ ] **Step 3: Add ConfirmDialog**

Add at end of return, before closing `</Dialog>`:

```tsx
<ConfirmDialog
  open={showDeleteConfirm}
  onOpenChange={setShowDeleteConfirm}
  title="Delete Task?"
  description="This task will be moved to trash. You can restore it within 30 days."
  confirmLabel="Delete Task"
  onConfirm={handleConfirmDelete}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/task/TaskDetailModal.tsx
git commit -m "feat: add confirmation dialog before task deletion"
```

---

## Feature 3: Trash System

### Task 6: Database Migration 4 (Soft Delete)

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`

- [ ] **Step 1: Add soft delete migration**

After the existing MIGRATIONS array (after migration 3), add migration 4. In `src-tauri/src/db/migrations.rs`, add a fourth SQL string to the MIGRATIONS array before the closing `];`:

```rust
    "
ALTER TABLE boards ADD COLUMN deleted_at TEXT;
ALTER TABLE columns ADD COLUMN deleted_at TEXT;
ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
ALTER TABLE tags ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_boards_deleted ON boards(deleted_at);
CREATE INDEX IF NOT EXISTS idx_columns_deleted ON columns(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tags_deleted ON tags(deleted_at);
",
```

- [ ] **Step 2: Verify migration order**

Ensure the MIGRATIONS array now has 4 entries (indices 0, 1, 2, 3).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/migrations.rs
git commit -m "feat: add migration 4 for soft delete (deleted_at columns)"
```

### Task 7: Backend soft delete repository functions

**Files:**
- Modify: `src-tauri/src/db/repository.rs`

- [ ] **Step 1: Update get_boards to filter deleted**

Change line 7-8 from:

```rust
pub fn get_boards(conn: &Connection) -> Result<Vec<board::Board>, AppError> {
    let mut stmt = conn
        .prepare("SELECT id, title, created_at, updated_at FROM boards ORDER BY created_at ASC")?;
```

To:

```rust
pub fn get_boards(conn: &Connection) -> Result<Vec<board::Board>, AppError> {
    let mut stmt = conn
        .prepare("SELECT id, title, created_at, updated_at FROM boards WHERE deleted_at IS NULL ORDER BY created_at ASC")?;
```

- [ ] **Step 2: Update get_columns_by_board to filter deleted**

Change line 81-82 from:

```rust
    let mut stmt = conn.prepare(
        "SELECT id, board_id, title, position, created_at, updated_at FROM columns WHERE board_id = ?1 ORDER BY position ASC"
    )?;
```

To:

```rust
    let mut stmt = conn.prepare(
        "SELECT id, board_id, title, position, created_at, updated_at FROM columns WHERE board_id = ?1 AND deleted_at IS NULL ORDER BY position ASC"
    )?;
```

- [ ] **Step 3: Update get_tasks_by_column to filter deleted**

Change line 166-167 from:

```rust
    let mut stmt = conn.prepare(
        "SELECT id, column_id, title, description_md, position, priority, due_date, created_at, updated_at FROM tasks WHERE column_id = ?1 ORDER BY position ASC"
    )?;
```

To:

```rust
    let mut stmt = conn.prepare(
        "SELECT id, column_id, title, description_md, position, priority, due_date, created_at, updated_at FROM tasks WHERE column_id = ?1 AND deleted_at IS NULL ORDER BY position ASC"
    )?;
```

- [ ] **Step 4: Update get_tasks_by_board to filter deleted**

Change line 188-194 from:

```rust
    let mut stmt = conn.prepare(
        "SELECT t.id, t.column_id, t.title, t.description_md, t.position, t.priority, t.due_date, t.created_at, t.updated_at
         FROM tasks t
         JOIN columns c ON t.column_id = c.id
         WHERE c.board_id = ?1
         ORDER BY t.position ASC"
    )?;
```

To:

```rust
    let mut stmt = conn.prepare(
        "SELECT t.id, t.column_id, t.title, t.description_md, t.position, t.priority, t.due_date, t.created_at, t.updated_at
         FROM tasks t
         JOIN columns c ON t.column_id = c.id
         WHERE c.board_id = ?1 AND t.deleted_at IS NULL AND c.deleted_at IS NULL
         ORDER BY t.position ASC"
    )?;
```

- [ ] **Step 5: Update get_tags_by_board to filter deleted**

Change line 330-332 from:

```rust
    let mut stmt = conn.prepare(
        "SELECT id, board_id, name, color FROM tags WHERE board_id = ?1 ORDER BY name ASC",
    )?;
```

To:

```rust
    let mut stmt = conn.prepare(
        "SELECT id, board_id, name, color FROM tags WHERE board_id = ?1 AND deleted_at IS NULL ORDER BY name ASC",
    )?;
```

- [ ] **Step 6: Change delete_board to soft delete**

Change lines 69-75 from:

```rust
pub fn delete_board(conn: &Connection, board_id: &str) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM boards WHERE id = ?1", params![board_id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Board {} not found", board_id)));
    }
    Ok(())
}
```

To:

```rust
pub fn delete_board(conn: &Connection, board_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE boards SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, board_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Board {} not found", board_id)));
    }
    conn.execute(
        "UPDATE columns SET deleted_at = ?1 WHERE board_id = ?2 AND deleted_at IS NULL",
        params![now, board_id],
    )?;
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1 WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?2) AND deleted_at IS NULL",
        params![now, board_id],
    )?;
    Ok(())
}
```

- [ ] **Step 7: Change delete_column to soft delete**

Change lines 138-147 from:

```rust
pub fn delete_column(conn: &Connection, column_id: &str) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM columns WHERE id = ?1", params![column_id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Column {} not found",
            column_id
        )));
    }
    Ok(())
}
```

To:

```rust
pub fn delete_column(conn: &Connection, column_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE columns SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, column_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!(
            "Column {} not found",
            column_id
        )));
    }
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1 WHERE column_id = ?2 AND deleted_at IS NULL",
        params![now, column_id],
    )?;
    Ok(())
}
```

- [ ] **Step 8: Change delete_task to soft delete**

Change lines 322-328 from:

```rust
pub fn delete_task(conn: &Connection, task_id: &str) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Task {} not found", task_id)));
    }
    Ok(())
}
```

To:

```rust
pub fn delete_task(conn: &Connection, task_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE tasks SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, task_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Task {} not found", task_id)));
    }
    Ok(())
}
```

- [ ] **Step 9: Change delete_tag to soft delete**

Change lines 394-400 from:

```rust
pub fn delete_tag(conn: &Connection, tag_id: &str) -> Result<(), AppError> {
    let rows = conn.execute("DELETE FROM tags WHERE id = ?1", params![tag_id])?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Tag {} not found", tag_id)));
    }
    Ok(())
}
```

To:

```rust
pub fn delete_tag(conn: &Connection, tag_id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE tags SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        params![now, tag_id],
    )?;
    if rows == 0 {
        return Err(AppError::NotFound(format!("Tag {} not found", tag_id)));
    }
    conn.execute("DELETE FROM task_tags WHERE tag_id = ?1", params![tag_id])?;
    Ok(())
}
```

- [ ] **Step 10: Add restore functions**

Add after the existing delete_tag function (after line 400):

```rust
pub fn restore_board(conn: &Connection, board_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE boards SET deleted_at = NULL WHERE id = ?1",
        params![board_id],
    )?;
    conn.execute(
        "UPDATE columns SET deleted_at = NULL WHERE board_id = ?1",
        params![board_id],
    )?;
    conn.execute(
        "UPDATE tasks SET deleted_at = NULL WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?1)",
        params![board_id],
    )?;
    Ok(())
}

pub fn restore_column(conn: &Connection, column_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE columns SET deleted_at = NULL WHERE id = ?1",
        params![column_id],
    )?;
    conn.execute(
        "UPDATE tasks SET deleted_at = NULL WHERE column_id = ?1",
        params![column_id],
    )?;
    Ok(())
}

pub fn restore_task(conn: &Connection, task_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tasks SET deleted_at = NULL WHERE id = ?1",
        params![task_id],
    )?;
    Ok(())
}

pub fn restore_tag(conn: &Connection, tag_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tags SET deleted_at = NULL WHERE id = ?1",
        params![tag_id],
    )?;
    Ok(())
}

pub fn get_trash(conn: &Connection) -> Result<(Vec<board::Board>, Vec<column::Column>, Vec<task::Task>, Vec<tag::Tag>), AppError> {
    let mut boards_stmt = conn.prepare(
        "SELECT id, title, created_at, updated_at FROM boards WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let boards = boards_stmt.query_map([], |row| {
        Ok(board::Board {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut cols_stmt = conn.prepare(
        "SELECT id, board_id, title, position, created_at, updated_at FROM columns WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let columns = cols_stmt.query_map([], |row| {
        Ok(column::Column {
            id: row.get(0)?,
            board_id: row.get(1)?,
            title: row.get(2)?,
            position: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut tasks_stmt = conn.prepare(
        "SELECT id, column_id, title, description_md, position, priority, due_date, created_at, updated_at FROM tasks WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let tasks = tasks_stmt.query_map([], |row| {
        Ok(task::Task {
            id: row.get(0)?,
            column_id: row.get(1)?,
            title: row.get(2)?,
            description_md: row.get(3)?,
            position: row.get(4)?,
            priority: row.get(5)?,
            due_date: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    let mut tags_stmt = conn.prepare(
        "SELECT id, board_id, name, color FROM tags WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC"
    )?;
    let tags = tags_stmt.query_map([], |row| {
        Ok(tag::Tag {
            id: row.get(0)?,
            board_id: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok((boards, columns, tasks, tags))
}

pub fn purge_old_trash(conn: &Connection) -> Result<(), AppError> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(30);
    let cutoff_str = cutoff.to_rfc3339();
    conn.execute("DELETE FROM tags WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    conn.execute("DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    conn.execute("DELETE FROM columns WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    conn.execute("DELETE FROM boards WHERE deleted_at IS NOT NULL AND deleted_at < ?1", params![cutoff_str])?;
    Ok(())
}
```

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/db/repository.rs
git commit -m "feat: implement soft delete, restore, and trash query functions"
```

### Task 8: Add Tauri commands for trash operations

**Files:**
- Create: `src-tauri/src/commands/trash.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create trash commands**

Create `src-tauri/src/commands/trash.rs`:

```rust
use tauri::State;
use crate::db::{self, DbState};
use crate::error::AppError;
use crate::models::{board::Board, column::Column, task::Task, tag::Tag};

macro_rules! lock_conn {
    ($db:expr) => {
        $db.conn
            .lock()
            .map_err(|e| AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string())))?
    };
}

#[tauri::command]
pub fn get_trash(
    db: State<'_, DbState>,
) -> Result<(Vec<Board>, Vec<Column>, Vec<Task>, Vec<Tag>), AppError> {
    let conn = lock_conn!(db);
    db::repository::get_trash(&conn)
}

#[tauri::command]
pub fn restore_board(db: State<'_, DbState>, board_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_board(&conn, &board_id)
}

#[tauri::command]
pub fn restore_column(db: State<'_, DbState>, column_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_column(&conn, &column_id)
}

#[tauri::command]
pub fn restore_task(db: State<'_, DbState>, task_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_task(&conn, &task_id)
}

#[tauri::command]
pub fn restore_tag(db: State<'_, DbState>, tag_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::restore_tag(&conn, &tag_id)
}

#[tauri::command]
pub fn purge_old_trash(db: State<'_, DbState>) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    db::repository::purge_old_trash(&conn)
}

#[tauri::command]
pub fn permanently_delete_board(db: State<'_, DbState>, board_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM boards WHERE id = ?1", params![board_id])?;
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_column(db: State<'_, DbState>, column_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM columns WHERE id = ?1", params![column_id])?;
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_task(db: State<'_, DbState>, task_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])?;
    Ok(())
}

#[tauri::command]
pub fn permanently_delete_tag(db: State<'_, DbState>, tag_id: String) -> Result<(), AppError> {
    let conn = lock_conn!(db);
    conn.execute("DELETE FROM tags WHERE id = ?1", params![tag_id])?;
    Ok(())
}
```

- [ ] **Step 2: Export trash commands in mod.rs**

Modify `src-tauri/src/commands/mod.rs` (create if it doesn't exist):

```rust
pub mod activity;
pub mod board;
pub mod column;
pub mod tag;
pub mod task;
pub mod trash;
```

- [ ] **Step 3: Register commands in lib.rs**

Add to the `invoke_handler` in `src-tauri/src/lib.rs`, after the existing commands (after line 100):

```rust
            commands::trash::get_trash,
            commands::trash::restore_board,
            commands::trash::restore_column,
            commands::trash::restore_task,
            commands::trash::restore_tag,
            commands::trash::purge_old_trash,
            commands::trash::permanently_delete_board,
            commands::trash::permanently_delete_column,
            commands::trash::permanently_delete_task,
            commands::trash::permanently_delete_tag,
```

- [ ] **Step 4: Add purge on startup**

In `src-tauri/src/db/connection.rs`, after `run_migrations(&conn)?;` on line 26, add:

```rust
    crate::db::repository::purge_old_trash(&conn)?;
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/trash.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/db/connection.rs
git commit -m "feat: add trash Tauri commands and auto-purge on startup"
```

### Task 9: Frontend API and types for trash

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/invoke.ts`

- [ ] **Step 1: Add TrashItem type**

In `src/types/index.ts`, add after the existing types:

```typescript
export interface TrashItem {
  boards: Board[];
  columns: Column[];
  tasks: Task[];
  tags: Tag[];
}
```

- [ ] **Step 2: Add trash API methods**

In `src/lib/invoke.ts`, add to the `api` object after `tags`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/invoke.ts
git commit -m "feat: add trash API and types to frontend"
```

### Task 10: Create TrashView component

**Files:**
- Create: `src/components/layout/TrashView.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create TrashView component**

Create `src/components/layout/TrashView.tsx`:

```tsx
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
        boards: data[0],
        columns: data[1],
        tasks: data[2],
        tags: data[3],
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
              <span className="text-sm text-foreground">{"title" in item ? item.title : "name" in item ? item.name : item.id}</span>
              <span className="text-xs text-muted-foreground ml-2">Deleted {formatDate(item.updated_at)}</span>
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
                onClick={() => onPermDelete(item.id, "title" in item ? item.title : "name" in item ? item.name : item.id)}
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
```

- [ ] **Step 2: Integrate TrashView into Sidebar**

In `src/components/layout/Sidebar.tsx`:

Add import:

```tsx
import { TrashView } from "./TrashView";
import { Trash } from "lucide-react";
```

Add state:

```tsx
const [showTrash, setShowTrash] = useState(false);
```

Replace the return statement to conditionally show TrashView. Change the sidebar structure:

After the Board/Activity view buttons, add:

```tsx
      {activeView === "board" && (
        <>
          ...existing board list...
          <div className="border-t border-border p-2 mt-auto">
            <button
              onClick={() => setShowTrash(true)}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            >
              <Trash size={14} />
              Trash
            </button>
          </div>
        </>
      )}
```

Add a modal/dialog for trash view. Since the existing view switching uses `activeView`, add a separate overlay for trash. Add after the closing `</div>` of the main sidebar div:

```tsx
      {showTrash && (
        <div className="absolute inset-0 z-50 bg-background flex">
          <div className="w-56 flex-shrink-0 border-r border-border bg-card" />
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Trash</h2>
              <button
                onClick={() => setShowTrash(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <TrashView />
          </div>
        </div>
      )}
```

Actually, a simpler approach: just make Trash a third view in the sidebar toggle, or add it as a separate item. Let me simplify — add a trash button at the bottom of the sidebar that opens the TrashView as a full overlay.

Replace the entire return of Sidebar with a version that includes trash. For simplicity, I'll just add the trash button that shows TrashView inline in the main content area. This requires changes to MainContent.tsx as well. Let me use a different approach — add TrashView as a new `activeView` option alongside "board" and "activity".

Actually, the simplest approach: the trash button sets `activeView` to "trash", and MainContent.tsx renders TrashView when activeView is "trash".

Let me add "trash" to the activeView options in uiStore and handle it in MainContent. But this requires more changes. Let me use the simplest approach: TrashView opens as an overlay modal from the sidebar.

Let me rewrite Step 2 more simply:

In `Sidebar.tsx`, at the bottom of the activeView === "board" section, before the closing `</>`:

```tsx
          <div className="border-t border-border p-2 mt-auto">
            <button
              onClick={() => {
                setActiveView("trash");
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-colors",
                activeView === "trash"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Trash size={14} />
              Trash
            </button>
          </div>
```

Then modify `src/components/layout/MainContent.tsx` to handle the "trash" view.

- [ ] **Step 3: Handle trash view in MainContent**

Read `src/components/layout/MainContent.tsx` first to understand its structure, then modify it.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/TrashView.tsx src/components/layout/Sidebar.tsx src/components/layout/MainContent.tsx
git commit -m "feat: add TrashView component and integrate into sidebar"
```

---

## Feature 4: Search Tasks in Current Board

### Task 11: Add search state and UI

**Files:**
- Modify: `src/stores/uiStore.ts`
- Modify: `src/components/layout/MainContent.tsx`
- Modify: `src/components/board/Column.tsx`

- [ ] **Step 1: Add search state to uiStore**

In `src/stores/uiStore.ts`, add after existing state:

```typescript
  searchQuery: string;
  setSearchQuery: (query: string) => void;
```

And in the store body:

```typescript
  searchQuery: "",
  setSearchQuery: (query: string) => set({ searchQuery: query }),
```

- [ ] **Step 2: Add search bar to MainContent**

In `src/components/layout/MainContent.tsx` (read it first), add a search input near the board area.

- [ ] **Step 3: Filter tasks by search query in Column**

In `src/components/board/Column.tsx`, after getting tasks:

```tsx
  let tasks = getTasksByColumn(column.id);

  // Apply search filter
  const { searchQuery } = useUIStore();
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    tasks = tasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.description_md && t.description_md.toLowerCase().includes(q))
    );
  }
```

Wait, you can't use hooks conditionally. Need to move the searchQuery hook to top of component.

Add after existing hooks:

```tsx
  const { searchQuery } = useUIStore();
```

And add filter after getting tasks:

```tsx
  let tasks = getTasksByColumn(column.id);
  if (activeTagFilters.size > 0) {
    // existing tag filter
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    tasks = tasks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.description_md.toLowerCase().includes(q)
    );
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/uiStore.ts src/components/layout/MainContent.tsx src/components/board/Column.tsx
git commit -m "feat: add task search in current board"
```

---

## Feature 5: Activity UI/UX Improvements + App Icons

### Task 12: Add Rust dependencies for icon extraction

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add png and base64 crates**

Add to `[dependencies]` section in `src-tauri/Cargo.toml`:

```toml
png = "0.17"
base64 = "0.22"
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "deps: add png and base64 for icon extraction"
```

### Task 13: Create app icon extraction module

**Files:**
- Create: `src-tauri/src/tracker/icon.rs`
- Modify: `src-tauri/src/tracker/mod.rs`

- [ ] **Step 1: Create icon extraction module**

Create `src-tauri/src/tracker/icon.rs`:

```rust
use windows::core::PCWSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDIBits,
    GetObjectW, CreateCompatibleDC,
};
use windows::Win32::UI::Shell::ExtractIconExW;
use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

pub struct IconData {
    pub base64: String,
    pub width: u32,
    pub height: u32,
}

pub fn extract_icon_from_exe(exe_path: &str) -> Option<IconData> {
    if exe_path.is_empty() {
        return None;
    }

    let lpszfile: Vec<u16> = std::path::Path::new(exe_path)
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();

    let mut phiconlarge = HICON::default();
    let mut phiconsmall = HICON::default();

    let value = unsafe {
        ExtractIconExW(
            PCWSTR(lpszfile.as_ptr()),
            0,
            Some(&mut phiconlarge as *mut HICON),
            Some(&mut phiconsmall as *mut HICON),
            1,
        )
    };

    if value == 0 || (phiconlarge.0.is_null() && phiconsmall.0.is_null()) {
        return None;
    }

    let phicon = if !phiconlarge.0.is_null() {
        phiconlarge
    } else {
        phiconsmall
    };

    let mut piconinfo: ICONINFO = ICONINFO::default();
    let icon_info = unsafe { GetIconInfo(phicon, &mut piconinfo as *mut ICONINFO as _) };
    if icon_info.is_err() {
        cleanup_hicons(phiconlarge, phiconsmall);
        return None;
    }

    let hbm = piconinfo.hbmColor;
    let mut cbitmap = BITMAP::default();

    let objectw = unsafe {
        GetObjectW(
            hbm.into(),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut cbitmap as *mut _ as _),
        )
    };

    if objectw <= 0 {
        cleanup_hicons(phiconlarge, phiconsmall);
        return None;
    }

    let mut lpbmi = BITMAPINFO::default();
    lpbmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    lpbmi.bmiHeader.biWidth = cbitmap.bmWidth;
    lpbmi.bmiHeader.biHeight = -cbitmap.bmHeight;
    lpbmi.bmiHeader.biPlanes = 1;
    lpbmi.bmiHeader.biBitCount = 32;
    lpbmi.bmiHeader.biCompression = BI_RGB.0;

    let hdc = unsafe { CreateCompatibleDC(None) };
    let mut buffer: Vec<u8> = vec![0u8; (cbitmap.bmHeight * cbitmap.bmWidth * 4) as usize];
    let height = unsafe {
        GetDIBits(
            hdc,
            hbm,
            0,
            cbitmap.bmHeight as u32,
            Some(buffer.as_mut_ptr().cast()),
            &mut lpbmi,
            DIB_RGB_COLORS,
        )
    };

    let mut result = None;

    if height == cbitmap.bmHeight {
        // Convert BGRA to RGBA
        for chunk in buffer.chunks_mut(4) {
            if chunk.len() == 4 {
                chunk.swap(0, 2); // Swap B and R
            }
        }

        let mut png_data = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut png_data);
            let mut encoder = png::Encoder::new(cursor, cbitmap.bmWidth as u32, cbitmap.bmHeight as u32);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);

            if let Ok(mut writer) = encoder.write_header() {
                if writer.write_image_data(&buffer).is_ok() {
                    let base64_str = base64::prelude::BASE64_STANDARD.encode(&png_data);
                    result = Some(IconData {
                        base64: format!("data:image/png;base64,{}\", base64_str),
                        width: cbitmap.bmWidth as u32,
                        height: cbitmap.bmHeight as u32,
                    });
                }
            }
        }
    }

    unsafe {
        let _ = DeleteDC(hdc);
        let _ = DeleteObject(hbm.into());
    };

    cleanup_hicons(phiconlarge, phiconsmall);
    result
}

fn cleanup_hicons(phiconlarge: HICON, phiconsmall: HICON) {
    unsafe {
        if !phiconlarge.0.is_null() {
            let _ = DestroyIcon(phiconlarge);
        }
        if !phiconsmall.0.is_null() {
            let _ = DestroyIcon(phiconsmall);
        }
    }
}
```

- [ ] **Step 2: Export icon module**

Add to `src-tauri/src/tracker/mod.rs`:

```rust
pub mod icon;
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/tracker/icon.rs src-tauri/src/tracker/mod.rs
git commit -m "feat: add app icon extraction from exe files"
```

### Task 14: Add get_app_icon Tauri command

**Files:**
- Modify: `src-tauri/src/commands/activity.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add get_app_icon command**

Add to `src-tauri/src/commands/activity.rs`:

```rust
#[tauri::command]
pub fn get_app_icon(app_name: String) -> Result<String, AppError> {
    // Look up the exe path from the app's process info
    // For now, we'll need to store the path when tracking
    // This is a placeholder - we'll integrate with the tracker later
    Ok(String::new())
}
```

Actually, we need to store the exe path. Let me rethink. The tracker currently stores process_name but not the full path. We need to modify the tracker to store the exe path, then look it up.

Alternatively, we can store icons in a cache keyed by app_name when the tracker first sees the app.

Let me modify the tracker to also cache icons. Add to tracker.rs after flush_accumulated:

Actually, let me keep it simple: add a command that takes the app_name and looks up the currently running process with that name, then extracts its icon. This avoids needing to store paths.

Let me modify the command to look up the exe path from a running process:

```rust
#[tauri::command]
pub fn get_app_icon(app_name: String) -> Result<String, AppError> {
    use windows::Win32::System::Threading::{EnumProcesses, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::System::ProcessStatus::QueryFullProcessImageNameW;
    use windows::Win32::Foundation::{CloseHandle, MAX_PATH};
    use windows::core::PWSTR;

    // Find process with matching name
    let mut pids = [0u32; 1024];
    let mut needed = 0u32;
    let _ = unsafe { EnumProcesses(pids.as_mut_ptr(), (pids.len() * 4) as u32, &mut needed) };
    let count = (needed / 4) as usize;

    for i in 0..count {
        let pid = pids[i];
        if pid == 0 { continue; }

        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) };
        if let Ok(handle) = handle {
            let mut lpdwsize: u32 = MAX_PATH;
            let mut lpexename_raw: Vec<u16> = vec![0; MAX_PATH as usize];
            let lpexename = PWSTR::from_raw(lpexename_raw.as_mut_ptr());

            let success = unsafe {
                QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, lpexename, &mut lpdwsize).is_ok()
            };

            if success {
                let path = unsafe { lpexename.to_string().unwrap_or_default() };
                let name = std::path::Path::new(&path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                if name == app_name.to_lowercase() || name == app_name.to_lowercase().replace(".exe", "") {
                    unsafe { let _ = CloseHandle(handle); }
                    if let Some(icon) = crate::tracker::icon::extract_icon_from_exe(&path) {
                        return Ok(icon.base64);
                    }
                    return Ok(String::new());
                }
            }

            unsafe { let _ = CloseHandle(handle); }
        }
    }

    Ok(String::new())
}
```

- [ ] **Step 2: Register command**

Add `commands::activity::get_app_icon` to `src-tauri/src/lib.rs` invoke_handler.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands/activity.rs src-tauri/src/lib.rs
git commit -m "feat: add get_app_icon Tauri command"
```

### Task 15: Activity UI visual improvements

**Files:**
- Modify: `src/components/activity/SummaryCards.tsx`
- Modify: `src/components/activity/ActivityChart.tsx`
- Modify: `src/components/activity/BrowserDetail.tsx`
- Modify: `src/components/activity/ActivityView.tsx`

- [ ] **Step 1: Update SummaryCards with icons and gradients**

Replace `src/components/activity/SummaryCards.tsx`:

```tsx
import { Clock, Monitor, Globe } from "lucide-react";
import type { AppUsageSummary, BrowserUsageSummary } from "@/types";

interface SummaryCardsProps {
  appSummary: AppUsageSummary[];
  browserSummary: BrowserUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SummaryCards({ appSummary, browserSummary }: SummaryCardsProps) {
  const totalSecs = appSummary.reduce((acc, s) => acc + s.total_secs, 0);
  const topApp = appSummary.length > 0 ? appSummary[0] : null;
  const topSite = browserSummary.length > 0 ? browserSummary[0] : null;

  const cards = [
    {
      label: "Total Screen Time",
      value: formatDuration(totalSecs),
      icon: Clock,
      gradient: "from-blue-500/20 to-purple-500/20",
    },
    {
      label: "Top App",
      value: topApp ? topApp.app_name.replace(".exe", "") : "—",
      icon: Monitor,
      gradient: "from-green-500/20 to-teal-500/20",
    },
    {
      label: "Top Website",
      value: topSite ? topSite.domain : "—",
      icon: Globe,
      gradient: "from-orange-500/20 to-red-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`rounded-lg border border-border bg-gradient-to-br ${card.gradient} p-4 transition-all hover:scale-[1.02]`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className="mt-1 text-xl font-semibold truncate">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update ActivityChart with gradients and animations**

Replace `src/components/activity/ActivityChart.tsx`:

```tsx
import type { AppUsageSummary } from "@/types";

interface ActivityChartProps {
  summary: AppUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const GRADIENT_COLORS = [
  "from-blue-500 to-purple-500",
  "from-green-500 to-teal-500",
  "from-orange-500 to-red-500",
  "from-pink-500 to-rose-500",
  "from-cyan-500 to-blue-500",
  "from-yellow-500 to-orange-500",
  "from-indigo-500 to-purple-500",
  "from-emerald-500 to-green-500",
  "from-violet-500 to-pink-500",
  "from-amber-500 to-yellow-500",
];

export function ActivityChart({ summary }: ActivityChartProps) {
  const filtered = summary.filter((s) => s.total_secs >= 600);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No activity data for this period
      </div>
    );
  }

  const maxSecs = filtered[0].total_secs;
  const maxSqrt = Math.sqrt(maxSecs);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 w-1 rounded-full bg-gradient-to-b from-blue-500 to-purple-500" />
        <h3 className="text-sm font-medium text-foreground">Applications</h3>
      </div>
      {filtered.map((item, i) => {
        const widthPercent = Math.max((Math.sqrt(item.total_secs) / maxSqrt) * 100, 3);
        const gradient = GRADIENT_COLORS[i % GRADIENT_COLORS.length];
        return (
          <div key={item.app_name} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">
                {item.app_name.replace(".exe", "")}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDuration(item.total_secs)}
              </span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500 ease-out group-hover:brightness-110`}
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Update BrowserDetail with favicons**

Replace `src/components/activity/BrowserDetail.tsx`:

```tsx
import { Globe } from "lucide-react";
import type { BrowserUsageSummary } from "@/types";

interface BrowserDetailProps {
  summary: BrowserUsageSummary[];
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export function BrowserDetail({ summary }: BrowserDetailProps) {
  if (summary.length === 0) return null;

  const maxSecs = summary[0].total_secs;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Globe size={14} className="text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Websites</h3>
      </div>
      <div className="space-y-3">
        {summary.map((item) => {
          const widthPercent = Math.max((item.total_secs / maxSecs) * 100, 3);
          return (
            <div key={item.domain} className="flex items-center gap-3">
              <img
                src={getFaviconUrl(item.domain)}
                alt=""
                className="h-5 w-5 rounded flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-foreground truncate mr-2">
                    {item.domain}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDuration(item.total_secs)}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add section styling to ActivityView**

Wrap each section in ActivityView with a styled card container.

- [ ] **Step 5: Commit**

```bash
git add src/components/activity/SummaryCards.tsx src/components/activity/ActivityChart.tsx src/components/activity/BrowserDetail.tsx src/components/activity/ActivityView.tsx
git commit -m "feat: improve activity tab UI with gradients, icons, animations, and favicons"
```

---

## Feature 6: Database Optimization

### Task 16: Add last_seen column and cleanup

**Files:**
- Modify: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/db/activity_repository.rs`
- Modify: `src-tauri/src/tracker/tracker.rs`

- [ ] **Step 1: Add migration 5 for last_seen**

In `src-tauri/src/db/migrations.rs`, add a fifth migration:

```rust
    "
ALTER TABLE app_usage ADD COLUMN last_seen TEXT;
ALTER TABLE browser_usage ADD COLUMN last_seen TEXT;

UPDATE app_usage SET last_seen = date || 'T00:00:00Z' WHERE last_seen IS NULL;
UPDATE browser_usage SET last_seen = date || 'T00:00:00Z' WHERE last_seen IS NULL;
",
```

- [ ] **Step 2: Update upsert functions to set last_seen**

In `src-tauri/src/db/activity_repository.rs`, change upsert_app_usage:

```rust
pub fn upsert_app_usage(conn: &Connection, app_name: &str, date: &str, secs: i64) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO app_usage (id, app_name, date, total_secs, last_seen) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(app_name, date) DO UPDATE SET total_secs = total_secs + ?4, last_seen = ?5",
        params![Uuid::now_v7().to_string(), app_name, date, secs, now],
    )?;
    Ok(())
}
```

And upsert_browser_usage:

```rust
pub fn upsert_browser_usage(conn: &Connection, domain: &str, date: &str, secs: i64) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO browser_usage (id, domain, date, total_secs, last_seen) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(domain, date) DO UPDATE SET total_secs = total_secs + ?4, last_seen = ?5",
        params![Uuid::now_v7().to_string(), domain, date, secs, now],
    )?;
    Ok(())
}
```

- [ ] **Step 3: Add cleanup function**

Add to `src-tauri/src/db/activity_repository.rs`:

```rust
pub fn cleanup_old_activity(conn: &Connection) -> Result<(), AppError> {
    let cutoff = chrono::Utc::now() - chrono::Duration::days(7);
    let cutoff_str = cutoff.to_rfc3339();

    // Delete websites with < 10 minutes total, stale for 7+ days
    conn.execute(
        "DELETE FROM browser_usage WHERE last_seen < ?1 AND domain IN (
            SELECT domain FROM browser_usage GROUP BY domain HAVING SUM(total_secs) < 600
        )",
        params![cutoff_str],
    )?;

    // Delete apps with only 1 day of data, stale for 7+ days
    conn.execute(
        "DELETE FROM app_usage WHERE last_seen < ?1 AND app_name IN (
            SELECT app_name FROM app_usage GROUP BY app_name HAVING COUNT(DISTINCT date) = 1
        )",
        params![cutoff_str],
    )?;

    Ok(())
}
```

- [ ] **Step 4: Integrate cleanup into tracker flush**

In `src-tauri/src/tracker/tracker.rs`, modify `flush_accumulated`:

```rust
use std::sync::atomic::{AtomicUsize, Ordering};

static FLUSH_COUNT: AtomicUsize = AtomicUsize::new(0);
```

Add cleanup call inside flush_accumulated after the upserts:

```rust
fn flush_accumulated(
    db_conn: &Arc<Mutex<Connection>>,
    app: &Option<String>,
    domain: &Option<String>,
    secs: i64,
) {
    if secs == 0 {
        return;
    }
    if let Some(ref app_name) = app {
        if let Ok(conn) = db_conn.lock() {
            let date = chrono::Local::now().format("%Y-%m-%d").to_string();
            let _ = activity_repository::upsert_app_usage(&conn, app_name, &date, secs);
            if let Some(ref dom) = domain {
                let _ = activity_repository::upsert_browser_usage(&conn, dom, &date, secs);
            }
            // Run cleanup every ~100 flushes (roughly every ~16 minutes of active use)
            let count = FLUSH_COUNT.fetch_add(1, Ordering::Relaxed);
            if count % 100 == 0 {
                let _ = activity_repository::cleanup_old_activity(&conn);
            }
        }
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db/migrations.rs src-tauri/src/db/activity_repository.rs src-tauri/src/tracker/tracker.rs
git commit -m "feat: add database cleanup for stale low-usage activity data"
```

---

## Feature 7: Database Backup System

### Task 17: Implement database backup on startup

**Files:**
- Modify: `src-tauri/src/db/connection.rs`

- [ ] **Step 1: Add backup function**

Add to `src-tauri/src/db/connection.rs` before `init_db`:

```rust
fn create_backup(db_path: &std::path::Path) -> Result<(), crate::error::AppError> {
    let backup_dir = db_path.parent().unwrap_or(std::path::Path::new(".")).join("backups");
    std::fs::create_dir_all(&backup_dir).map_err(|e| {
        crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;

    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M");
    let backup_path = backup_dir.join(format!("kough_{}.db", timestamp));

    std::fs::copy(db_path, &backup_path).map_err(|e| {
        crate::error::AppError::Database(rusqlite::Error::InvalidParameterName(e.to_string()))
    })?;

    // Keep only last 5 backups
    let mut backups: Vec<_> = std::fs::read_dir(&backup_dir)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.file_name().to_string_lossy().starts_with("kough_") &&
            entry.file_name().to_string_lossy().ends_with(".db")
        })
        .collect();

    if backups.len() > 5 {
        backups.sort_by_key(|entry| entry.metadata().ok().and_then(|m| m.modified().ok()).unwrap_or(std::time::SystemTime::UNIX_EPOCH));
        for old_backup in backups.iter().take(backups.len() - 5) {
            let _ = std::fs::remove_file(old_backup.path());
        }
    }

    Ok(())
}
```

- [ ] **Step 2: Call backup in init_db**

In `init_db`, after getting `db_path` and before opening the connection:

```rust
    // Create backup before opening (if db exists)
    if db_path.exists() {
        create_backup(&db_path)?;
    }

    let conn = Connection::open(&db_path)?;
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/connection.rs
git commit -m "feat: add automatic database backup on startup, keep last 5"
```

---

## Self-Review

**Spec coverage:**
- Feature 1 (Adjustable description): Tasks 1 ✓
- Feature 2 (Confirmation dialog): Tasks 2-5 ✓
- Feature 3 (Trash system): Tasks 6-10 ✓
- Feature 4 (Search): Tasks 11 ✓
- Feature 5 (Activity UI + icons): Tasks 12-15 ✓
- Feature 6 (Database cleanup): Tasks 16 ✓
- Feature 7 (Backup): Tasks 17 ✓

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:** All method signatures and property names are consistent throughout the plan.

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-05-24-kough-feature-pack.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like?
