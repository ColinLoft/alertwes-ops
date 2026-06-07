import { ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Plane,
  Flame,
  Warehouse,
  ShieldAlert,
  Camera,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ApprovalGate } from "@/components/ApprovalGate";

interface NavItem { title: string; url: string; icon: typeof Flame }

const PRIMARY: NavItem[] = [
  { title: "Incidents", url: "/incidents", icon: Flame },
  { title: "Cameras", url: "/", icon: Camera },
  { title: "Fleet", url: "/fleet", icon: Plane },
  { title: "Bases", url: "/bases", icon: Warehouse },
  { title: "Disaster", url: "/disaster", icon: ShieldAlert },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

function NavTile({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.url}
      className={`group flex h-14 w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border transition-all ${
        active
          ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_18px_-6px_var(--primary)]"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground"
      }`}
    >
      <item.icon className="h-5 w-5" />
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
        {item.title}
      </span>
    </Link>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const z = now ? now.toISOString().slice(11, 19) : "--:--:--";
  const local = now ? now.toLocaleTimeString([], { hour12: false }) : "--:--:--";
  return (
    <div className="hidden lg:flex flex-col items-end font-mono text-[10px] leading-tight text-muted-foreground" suppressHydrationWarning>
      <span><span className="text-foreground/90" suppressHydrationWarning>{local}</span> <span className="opacity-60">LOCAL</span></span>
      <span><span className="text-foreground/90" suppressHydrationWarning>{z}</span><span className="opacity-60">Z</span></span>
    </div>
  );
}

function HealthChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px currentColor" }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function TopBar() {
  const [settings] = useSettings();
  const { userId, email, roles, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <header className="sticky top-0 z-30 glass-strong border-b border-white/10">
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Brand */}
        <Link to="/incidents" className="flex h-14 items-center gap-2.5 shrink-0 pr-3 border-r border-white/10">
          {settings.logoDataUrl ? (
            <img src={settings.logoDataUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-md grid place-items-center text-[11px] font-black"
                 style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              AE
            </div>
          )}
          <div className="hidden sm:block leading-tight">
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">CAD</div>
            <div className="text-[14px] font-bold tracking-tight">{settings.brandName || "Aegis"}</div>
          </div>
        </Link>

        {/* Nav tiles */}
        <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto">
          {PRIMARY.map((it) => <NavTile key={it.url} item={it} active={isActive(it.url)} />)}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden xl:flex items-center gap-1">
            <HealthChip label="AlertWest" />
            <HealthChip label="NWS" />
            <HealthChip label="FIRMS" />
            <HealthChip label="AI" />
          </div>
          <Clock />
          {!loading && userId && (
            <div className="hidden md:block text-right leading-tight">
              <div className="text-[10.5px] text-foreground/90 truncate max-w-[160px]">{email}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {roles.length ? roles.join(" · ") : "no role"}
              </div>
            </div>
          )}
          {!loading && userId && (
            <button onClick={signOut}
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
              title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5"
            aria-label="Menu">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 px-2 py-2 grid grid-cols-3 gap-1.5">
          {PRIMARY.map((it) => (
            <Link key={it.url} to={it.url} onClick={() => setOpen(false)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-semibold uppercase tracking-wider ${
                isActive(it.url) ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground"
              }`}>
              <it.icon className="h-5 w-5" />
              {it.title}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ApprovalGate>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
        <TopBar />
        <main className="flex-1 min-h-0 min-w-0 relative overflow-auto">{children}</main>
      </div>
    </ApprovalGate>
  );
}
