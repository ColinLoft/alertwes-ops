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
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.url}
      className={`group inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      }`}
    >
      <item.icon className="h-3.5 w-3.5" />
      <span>{item.title}</span>
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
    <div className="hidden lg:flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground" suppressHydrationWarning>
      <span><span className="text-foreground/80" suppressHydrationWarning>{local}</span> LOCAL</span>
      <span className="opacity-50">|</span>
      <span><span className="text-foreground/80" suppressHydrationWarning>{z}</span>Z</span>
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
      <div className="flex h-11 items-center gap-3 px-3">
        <Link to="/incidents" className="flex items-center gap-2 shrink-0">
          {settings.logoDataUrl ? (
            <img src={settings.logoDataUrl} alt="" className="h-6 w-6 rounded object-cover" />
          ) : (
            <div className="h-6 w-6 rounded grid place-items-center text-[9px] font-black"
                 style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              AE
            </div>
          )}
          <div className="hidden sm:block leading-tight">
            <div className="text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground">CAD</div>
            <div className="text-[12px] font-semibold">{settings.brandName || "Aegis"}</div>
          </div>
        </Link>

        <div className="hidden xl:flex items-center gap-1 ml-1">
          <HealthChip label="AlertWest" />
          <HealthChip label="NWS" />
          <HealthChip label="FIRMS" />
          <HealthChip label="AI" />
        </div>

        <nav className="hidden md:flex items-center gap-0.5 mx-2 overflow-x-auto">
          {PRIMARY.map((it) => <NavLink key={it.url} item={it} active={isActive(it.url)} />)}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Clock />
          <Link
            to="/settings"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] text-foreground/80 hover:bg-white/10"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Settings</span>
          </Link>
          {!loading && userId && (
            <div className="flex items-center gap-2">
              <div className="hidden md:block text-right leading-tight">
                <div className="text-[10.5px] text-foreground/90 truncate max-w-[160px]">{email}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {roles.length ? roles.join(" · ") : "no role"}
                </div>
              </div>
              <button onClick={signOut}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
                title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5"
            aria-label="Menu">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 px-2 py-2 grid grid-cols-2 gap-1">
          {PRIMARY.map((it) => (
            <Link key={it.url} to={it.url} onClick={() => setOpen(false)}
              className={`inline-flex h-9 items-center gap-2 rounded-md px-2 text-xs font-medium ${
                isActive(it.url) ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}>
              <it.icon className="h-4 w-4" />
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
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
        <TopBar />
        <main className="flex-1 min-h-0 min-w-0 relative">{children}</main>
      </div>
    </ApprovalGate>
  );
}
