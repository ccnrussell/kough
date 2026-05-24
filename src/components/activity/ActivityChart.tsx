import { useEffect } from "react";
import { useActivityStore } from "@/stores/activityStore";
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
  const { iconCache, fetchAppIcon } = useActivityStore();
  const filtered = summary.filter((s) => s.total_secs >= 600);

  useEffect(() => {
    const appNames = filtered.map((s) => s.app_name);
    appNames.forEach((name) => {
      fetchAppIcon(name);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

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
        const iconSrc = iconCache[item.app_name];
        return (
          <div key={item.app_name} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="h-5 w-5 rounded flex-shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded bg-secondary flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {item.app_name.replace(".exe", "")}
                </span>
              </div>
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
