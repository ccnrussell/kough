import { getCurrentWindow } from "@tauri-apps/api/window";
import { PanelLeftClose, PanelLeft, Minus, Square, X, Menu } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { isMobile } from "@/lib/platform";

export function TitleBar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const mobile = isMobile();

  return (
    <div className="flex h-9 items-center justify-between border-b border-border bg-card select-none">
      <div
        data-tauri-drag-region
        className="flex h-full flex-1 items-center px-2"
      >
        <button
          onClick={toggleSidebar}
          className="mr-2 rounded p-1 hover:bg-accent transition-colors"
        >
          {mobile ? (
            <Menu size={16} />
          ) : sidebarOpen ? (
            <PanelLeftClose size={16} />
          ) : (
            <PanelLeft size={16} />
          )}
        </button>
        <span
          data-tauri-drag-region
          className="text-sm font-semibold tracking-wide text-foreground"
        >
          KOUGH
        </span>
      </div>

      {!mobile && (
        <div className="flex h-full items-center">
          <button
            onClick={() => getCurrentWindow().minimize()}
            className="flex h-full w-10 items-center justify-center hover:bg-accent transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => getCurrentWindow().toggleMaximize()}
            className="flex h-full w-10 items-center justify-center hover:bg-accent transition-colors"
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => getCurrentWindow().hide()}
            className="flex h-full w-10 items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
