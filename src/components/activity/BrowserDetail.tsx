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
