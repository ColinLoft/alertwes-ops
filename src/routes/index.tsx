import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Radio, FileText, Plane, ArrowRight, Settings as SettingsIcon, LogOut } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchIncidents } from "@/lib/incidents";
import { fetchDrones } from "@/lib/drones";
import { APPS } from "@/components/AppChrome";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Aegis — App Launcher" }] }),
  component: Launcher,
  ssr: false,
});

const TILES = [
  {
    app: APPS.cad,
    icon: Flame,
    desc: "Wildfire incidents, cameras, FIRMS hotspots, weather alerts.",
    href: "/incidents",
    statKey: "activeIncidents" as const,
    statLabel: "Active Incidents",
  },
  {
    app: APPS.dispatch,
    icon: Radio,
    desc: "Active calls board, signed-in units, cross-agency status.",
    href: "/dispatch",
    statKey: "activeCalls" as const,
    statLabel: "Active Calls",
  },
  {
    app: APPS.records,
    icon: FileText,
    desc: "Incident reports, BOLOs, citations, archived records.",
    href: "/reports",
    statKey: "reports" as const,
    statLabel: "Open Reports",
  },
  {
    app: APPS.flight,
    icon: Plane,
    desc: "Drone fleet roster, bases, maintenance, dispatch readiness.",
    href: "/fleet",
    statKey: "readyDrones" as const,
    statLabel: "Ready Drones",
  },
];

function Launcher() {
  const [settings] = useSettings();
  const { userId, email, roles, loading } = useAuth();
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 30_000 });
  const { data: drones = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones, refetchInterval: 30_000 });

  const stats = {
    activeIncidents: incidents.filter((i) => !["closed", "false_positive"].includes(i.status)).length,
    activeCalls: incidents.filter((i) => ["new", "triaging", "dispatched", "onscene"].includes(i.status)).length,
    reports: incidents.filter((i) => i.status !== "closed").length,
    readyDrones: drones.filter((d) => d.status === "ready").length,
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-foreground" style={{ background: "oklch(0.10 0.01 250)" }}>
      {/* Title bar */}
      <div className="flex h-9 items-center gap-3 border-b border-black/40 px-3 text-[12px]"
        style={{ background: "linear-gradient(180deg, oklch(0.32 0.01 250), oklch(0.22 0.01 250))" }}>
        <div className="flex items-center gap-2">
          {settings.logoDataUrl ? (
            <img src={settings.logoDataUrl} alt="" className="h-5 w-5 rounded-sm object-cover" />
          ) : (
            <div className="h-5 w-5 rounded-sm grid place-items-center text-[10px] font-black bg-primary text-primary-foreground">A</div>
          )}
          <span className="font-bold tracking-wide">{settings.brandName ?? "Aegis"} Operations</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">App Launcher</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px currentColor" }} />
            All Systems Online
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
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          )}
        </div>
      </div>

      {/* Launcher body */}
      <div className="flex-1 min-h-0 overflow-auto p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Welcome</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Select an Application</h1>
            <p className="mt-1 text-sm text-muted-foreground">Each module is independent — pin a desktop shortcut to the URL you use most.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {TILES.map(({ app, icon: Icon, desc, href, statKey, statLabel }) => (
              <Link
                key={app.key}
                to={href}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/25 hover:bg-white/[0.06]"
                style={{ boxShadow: `inset 0 1px 0 oklch(1 0 0 / 0.05)` }}
              >
                <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-15 blur-2xl transition-opacity group-hover:opacity-30" style={{ background: app.accent }} />
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${app.accent}, color-mix(in oklab, ${app.accent} 50%, black))` }}>
                    <Icon className="h-9 w-9 text-black/85" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: app.accent }}>{app.short}</div>
                    <div className="text-xl font-bold tracking-tight">{app.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between border-t border-white/10 pt-3">
                  <div>
                    <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{statLabel}</div>
                    <div className="text-2xl font-black tabular-nums" style={{ color: app.accent }}>{stats[statKey]}</div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                    Launch <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
