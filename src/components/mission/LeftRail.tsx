import { Link, useRouterState } from "@tanstack/react-router";
import {
  Radio, Camera as CameraIcon, Plane as PlaneIcon, FileText, BarChart3,
  Settings as SettingsIcon, Warehouse, ShieldAlert, Rss, Map as MapIcon,
} from "lucide-react";
import { useMission } from "@/lib/mission-store";
import type { LucideIcon } from "lucide-react";

interface RailItem {
  key: "incidents" | "cameras" | "units";
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface LinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function LeftRail({
  counts,
}: {
  counts: { incidents: number; cameras: number; units: number };
}) {
  const drawer = useMission((s) => s.drawer);
  const toggleDrawer = useMission((s) => s.toggleDrawer);
  const feedOpen = useMission((s) => s.feedOpen);
  const setFeedOpen = useMission((s) => s.setFeedOpen);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const drawerItems: RailItem[] = [
    { key: "incidents", label: "Calls",    icon: Radio,       count: counts.incidents },
    { key: "cameras",   label: "Cameras",  icon: CameraIcon,  count: counts.cameras },
    { key: "units",     label: "Units",    icon: PlaneIcon,   count: counts.units },
  ];

  const linkItems: LinkItem[] = [
    { to: "/reports",   label: "Reports",   icon: FileText },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/disaster",  label: "Disaster",  icon: ShieldAlert },
    { to: "/bases",     label: "Bases",     icon: Warehouse },
  ];

  return (
    <div className="z-[1100] flex h-full w-14 flex-col items-center gap-1 border-r border-white/10 bg-black/60 py-2 backdrop-blur-xl">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-amber-400/25 to-orange-500/25 text-[10px] font-black uppercase tracking-wider text-amber-200 shadow-inner ring-1 ring-amber-400/30">
        <MapIcon className="h-4 w-4" />
      </div>

      {drawerItems.map((item) => {
        const Icon = item.icon;
        const active = drawer === item.key;
        return (
          <button
            key={item.key}
            onClick={() => toggleDrawer(item.key)}
            title={item.label}
            className={`group relative flex h-11 w-11 flex-col items-center justify-center rounded-lg transition-colors ${
              active ? "bg-white/[0.09] ring-1 ring-white/15" : "hover:bg-white/[0.05]"
            }`}
          >
            <Icon className={`h-[18px] w-[18px] ${active ? "text-primary" : "text-foreground/80"}`} strokeWidth={1.8} />
            <span className={`mt-0.5 text-[8.5px] font-semibold tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>
              {item.label.toUpperCase()}
            </span>
            {typeof item.count === "number" && item.count > 0 && (
              <span className="absolute right-1 top-1 min-w-[14px] rounded-full bg-primary px-1 text-center text-[9px] font-bold leading-[14px] text-primary-foreground">
                {item.count > 99 ? "99+" : item.count}
              </span>
            )}
          </button>
        );
      })}

      <button
        onClick={() => setFeedOpen(!feedOpen)}
        title="Live feed"
        className={`mt-1 flex h-11 w-11 flex-col items-center justify-center rounded-lg transition-colors ${
          feedOpen ? "bg-white/[0.09] ring-1 ring-white/15" : "hover:bg-white/[0.05]"
        }`}
      >
        <Rss className={`h-[18px] w-[18px] ${feedOpen ? "text-primary" : "text-foreground/80"}`} strokeWidth={1.8} />
        <span className={`mt-0.5 text-[8.5px] font-semibold tracking-wider ${feedOpen ? "text-primary" : "text-muted-foreground"}`}>FEED</span>
      </button>

      <div className="my-2 h-px w-8 bg-white/10" />

      {linkItems.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            title={item.label}
            className={`flex h-11 w-11 flex-col items-center justify-center rounded-lg transition-colors ${
              active ? "bg-white/[0.09] ring-1 ring-white/15" : "hover:bg-white/[0.05]"
            }`}
          >
            <Icon className={`h-[18px] w-[18px] ${active ? "text-primary" : "text-foreground/80"}`} strokeWidth={1.8} />
            <span className={`mt-0.5 text-[8.5px] font-semibold tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>
              {item.label.slice(0, 4).toUpperCase()}
            </span>
          </Link>
        );
      })}

      <div className="mt-auto">
        <Link
          to="/settings"
          title="Settings"
          className="flex h-11 w-11 flex-col items-center justify-center rounded-lg transition-colors hover:bg-white/[0.05]"
        >
          <SettingsIcon className="h-[18px] w-[18px] text-foreground/80" strokeWidth={1.8} />
          <span className="mt-0.5 text-[8.5px] font-semibold tracking-wider text-muted-foreground">SET</span>
        </Link>
      </div>
    </div>
  );
}
