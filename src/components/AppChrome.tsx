import { ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Flame, Camera, ShieldAlert, BarChart3, Plane, Warehouse, FileText,
  Settings as SettingsIcon, Radio, Users, AlertOctagon, Archive, History,
  Map as MapIcon, Power,
  type LucideIcon,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ApprovalGate } from "@/components/ApprovalGate";

export type AppKey = "launcher" | "cad" | "dispatch" | "records" | "flight";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  fkey?: string;
}

export interface AppConfig {
  key: AppKey;
  name: string;
  short: string;
  accent: string; // CSS color
  nav: NavItem[];
}

export const APPS: Record<Exclude<AppKey, "launcher">, AppConfig> = {
  cad: {
    key: "cad",
    name: "Aegis CAD / Dispatch",
    short: "CAD",
    accent: "oklch(0.72 0.18 45)", // amber
    nav: [
      { title: "Incidents", url: "/incidents", icon: Flame, fkey: "F2" },
      { title: "Active Calls", url: "/dispatch", icon: Radio, fkey: "F3" },
      { title: "Units", url: "/dispatch/units", icon: Users, fkey: "F4" },
      { title: "Cameras", url: "/cameras", icon: Camera, fkey: "F5" },
      { title: "Disaster", url: "/disaster", icon: ShieldAlert, fkey: "F6" },
    ],
  },
  dispatch: {
    key: "dispatch",
    name: "Aegis CAD / Dispatch",
    short: "CAD",
    accent: "oklch(0.72 0.18 45)",
    nav: [
      { title: "Incidents", url: "/incidents", icon: Flame, fkey: "F2" },
      { title: "Active Calls", url: "/dispatch", icon: Radio, fkey: "F3" },
      { title: "Units", url: "/dispatch/units", icon: Users, fkey: "F4" },
      { title: "Cameras", url: "/cameras", icon: Camera, fkey: "F5" },
      { title: "Disaster", url: "/disaster", icon: ShieldAlert, fkey: "F6" },
    ],
  },
  records: {
    key: "records",
    name: "Aegis Records",
    short: "RECORDS",
    accent: "oklch(0.68 0.05 250)", // slate
    nav: [
      { title: "Reports", url: "/reports", icon: FileText, fkey: "F2" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, fkey: "F3" },
      { title: "Archive", url: "/archive", icon: Archive, fkey: "F4" },
      { title: "Audit Log", url: "/audit", icon: History, fkey: "F5" },
    ],
  },
  flight: {
    key: "flight",
    name: "Aegis Flight Ops",
    short: "FLIGHT OPS",
    accent: "oklch(0.72 0.15 200)", // cyan
    nav: [
      { title: "Fleet", url: "/fleet", icon: Plane, fkey: "F2" },
      { title: "Bases", url: "/bases", icon: Warehouse, fkey: "F3" },
      { title: "Map", url: "/incidents", icon: MapIcon, fkey: "F4" },
    ],
  },
};

export function appForPath(pathname: string): AppKey {
  if (/^\/(reports|archive|audit|analytics|bolo|citations)/.test(pathname)) return "records";
  if (/^\/(fleet|bases)/.test(pathname)) return "flight";
  // CAD/Dispatch are merged — everything else falls through to the unified CAD shell.
  return "cad";
}


function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const local = now ? now.toLocaleTimeString([], { hour12: false }) : "--:--:--";
  const dateStr = now ? now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
  return (
    <div className="hidden md:flex flex-col items-end font-mono text-[11px] leading-tight text-foreground/90" suppressHydrationWarning>
      <span className="font-bold tracking-wider" suppressHydrationWarning>{local} PST</span>
      <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>{dateStr}</span>
    </div>
  );
}

function FKeyTile({ item, active, accent }: { item: NavItem; active: boolean; accent: string }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.url}
      className={`group relative flex h-[78px] min-w-[88px] shrink-0 flex-col items-center justify-center gap-1 px-3 transition-all border-r border-white/5 ${
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
      }`}
      style={active ? { boxShadow: `inset 0 -3px 0 ${accent}` } : undefined}
    >
      {item.fkey && (
        <span className="absolute top-1 left-1.5 text-[8.5px] font-bold tracking-wider text-muted-foreground/70">
          {item.fkey}
        </span>
      )}
      <Icon className="h-7 w-7" style={{ color: active ? accent : undefined }} strokeWidth={1.8} />
      <span className={`text-[10.5px] font-semibold tracking-wide ${active ? "text-foreground" : "text-foreground/85"}`}>
        {item.title}
      </span>
    </Link>
  );
}

function StatusChip({ label, value, tone = "muted" }: { label: string; value: ReactNode; tone?: "muted" | "ok" | "warn" | "alert" }) {
  const colors = {
    muted: "border-white/10 bg-white/[0.04] text-foreground/80",
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    alert: "border-red-500/40 bg-red-500/15 text-red-300",
  }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-sm border px-3 py-1 ${colors}`}>
      <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-bold tabular-nums">{value}</span>
    </div>
  );
}

interface AppChromeProps {
  app: AppKey;
  statusLeft?: ReactNode;
  statusCenter?: ReactNode;
  statusRight?: ReactNode;
  bottomActions?: ReactNode;
  children: ReactNode;
}

export function AppChrome({ app, statusLeft, statusCenter, statusRight, bottomActions, children }: AppChromeProps) {
  const [settings] = useSettings();
  const { userId, email, roles, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cfg = app === "launcher" ? null : APPS[app];
  const accent = cfg?.accent ?? "oklch(0.72 0.18 45)";

  const signOut = async () => { await supabase.auth.signOut(); };

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url === "/incidents") return pathname === "/incidents";
    return pathname === url || pathname.startsWith(url + "/");
  };

  return (
    <ApprovalGate>
      <div
        data-app={app}
        className="flex h-screen w-full flex-col overflow-hidden text-foreground"
        style={{ ["--app-accent" as any]: accent, background: "oklch(0.10 0.01 250)" }}
      >
        {/* === Title bar (gray chrome) === */}
        <div
          className="flex h-9 items-center gap-3 border-b border-black/40 px-3 text-[12px]"
          style={{ background: "linear-gradient(180deg, oklch(0.32 0.01 250), oklch(0.22 0.01 250))" }}
        >
          <Link to="/" className="flex items-center gap-2">
            {settings.logoDataUrl ? (
              <img src={settings.logoDataUrl} alt="" className="h-5 w-5 rounded-sm object-cover" />
            ) : (
              <div className="h-5 w-5 rounded-sm grid place-items-center text-[10px] font-black" style={{ background: accent, color: "oklch(0.15 0.02 250)" }}>
                {cfg?.short.charAt(0) ?? "A"}
              </div>
            )}
            <span className="font-bold tracking-wide text-foreground">{cfg?.name ?? settings.brandName ?? "Aegis"}</span>
            {cfg && <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{cfg.short}</span>}
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px currentColor" }} />
              Live
            </span>
            {!loading && userId && (
              <span className="hidden md:inline text-[11px] text-foreground/80 truncate max-w-[180px]">
                {email} <span className="text-muted-foreground">· {roles[0] ?? "no role"}</span>
              </span>
            )}
            <Link to="/settings" className="inline-flex h-6 items-center gap-1 rounded-sm border border-white/10 bg-white/5 px-2 text-[10.5px] font-semibold uppercase tracking-wider hover:bg-white/10">
              <SettingsIcon className="h-3 w-3" /> Settings
            </Link>
            {!loading && userId && (
              <button onClick={signOut} className="inline-flex h-6 items-center gap-1 rounded-sm border border-red-500/30 bg-red-500/10 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-red-300 hover:bg-red-500/20">
                <Power className="h-3 w-3" /> Clock Out
              </button>
            )}
          </div>
        </div>

        {/* === F-key icon toolbar === */}
        {cfg && (
          <div
            className="flex items-stretch overflow-x-auto border-b border-black/40"
            style={{ background: "linear-gradient(180deg, oklch(0.20 0.01 250), oklch(0.14 0.01 250))" }}
          >
            <div className="flex h-[78px] shrink-0 items-center justify-center px-4 border-r border-white/10" style={{ background: `linear-gradient(180deg, ${accent}, color-mix(in oklab, ${accent} 60%, black))` }}>
              <span className="text-[11px] font-black tracking-[0.2em] text-black/85">{cfg.short}</span>
            </div>
            {cfg.nav.map((item) => (
              <FKeyTile key={item.url + item.title} item={item} active={isActive(item.url)} accent={accent} />
            ))}
            <Link
              to="/incidents"
              className="ml-auto flex h-[78px] w-[110px] shrink-0 flex-col items-center justify-center gap-1 border-l border-black/40"
              style={{ background: "linear-gradient(180deg, oklch(0.55 0.22 25), oklch(0.40 0.20 25))" }}
            >
              <AlertOctagon className="h-7 w-7 text-white" />
              <span className="text-[10.5px] font-black tracking-wider text-white">EMERGENCY</span>
            </Link>
          </div>
        )}

        {/* === Status strip === */}
        {cfg && (
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-3 py-1.5">
            <div className="flex items-center gap-2">
              {statusLeft}
            </div>
            <div className="flex flex-1 items-center justify-center gap-2">
              {statusCenter}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {statusRight}
              <Clock />
            </div>
          </div>
        )}

        {/* === Main === */}
        <main className="flex-1 min-h-0 min-w-0 relative overflow-auto">{children}</main>

        {/* === Bottom action bar === */}
        {bottomActions && (
          <div className="flex items-center justify-between gap-2 border-t border-black/40 bg-gradient-to-b from-white/5 to-black/30 px-2 py-1.5">
            {bottomActions}
          </div>
        )}
      </div>
    </ApprovalGate>
  );
}

export { StatusChip };
