import { useEffect } from "react";
import { Clock, Globe } from "lucide-react";
import { useActivityStore } from "@/stores/activityStore";
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
  const { iconCache, fetchAppIcon } = useActivityStore();
  const totalSecs = appSummary.reduce((acc, s) => acc + s.total_secs, 0);
  const topApp = appSummary.length > 0 ? appSummary[0] : null;
  const topSite = browserSummary.length > 0 ? browserSummary[0] : null;

  useEffect(() => {
    if (topApp) {
      fetchAppIcon(topApp.app_name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topApp?.app_name]);

  const topAppIcon = topApp ? iconCache[topApp.app_name] : null;

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
      gradient: "from-green-500/20 to-teal-500/20",
      iconSrc: topAppIcon,
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
        return (
          <div key={card.label} className={`rounded-lg border border-border bg-gradient-to-br ${card.gradient} p-4 transition-all hover:scale-[1.02]`}>
            <div className="flex items-center gap-2 mb-1">
              {"iconSrc" in card && card.iconSrc ? (
                <img src={card.iconSrc} alt="" className="h-3.5 w-3.5 rounded flex-shrink-0" />
              ) : "icon" in card && card.icon ? (
                <card.icon size={14} className="text-muted-foreground" />
              ) : (
                <div className="h-3.5 w-3.5 rounded bg-secondary flex-shrink-0" />
              )}
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
            <p className="mt-1 text-xl font-semibold truncate">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
