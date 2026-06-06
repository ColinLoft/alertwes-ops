import { ReactNode, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Radar,
  Plane,
  Flame,
  Warehouse,
  ShieldAlert,
  Wrench,
  Users,
  Settings as SettingsIcon,
  LogIn,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useAuth, type AppRole } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  title: string;
  url: string;
  icon: typeof Radar;
  roles?: AppRole[];
}

const PRIMARY: NavItem[] = [
  { title: "Dispatch", url: "/", icon: Radar },
  { title: "Fleet", url: "/fleet", icon: Plane },
  { title: "Incidents", url: "/incidents", icon: Flame },
  { title: "Bases", url: "/bases", icon: Warehouse },
  { title: "Disaster", url: "/disaster", icon: ShieldAlert },
];

const SECONDARY: NavItem[] = [
  { title: "Maintenance", url: "/ops/maintenance", icon: Wrench },
  { title: "Personnel", url: "/ops/personnel", icon: Users },
  { title: "Admin", url: "/admin", icon: SettingsIcon, roles: ["admin"] },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.url}
      className={`group inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
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

function ClockUTC() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const z = now ? now.toISOString().slice(11, 19) : "--:--:--";
  const local = now ? now.toLocaleTimeString([], { hour12: false }) : "--:--:--";
  return (
    <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-muted-foreground" suppressHydrationWarning>
      <span><span className="text-foreground/80" suppressHydrationWarning>{local}</span> LOCAL</span>
      <span className="opacity-50">|</span>
      <span><span className="text-foreground/80" suppressHydrationWarning>{z}</span>Z</span>
    </div>
  );
}

function HealthChip({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
      <span
        className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-500"}`}
        style={ok ? { boxShadow: "0 0 6px currentColor" } : undefined}
      />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function TopBar() {
  const [settings] = useSettings();
  const { userId, email, roles, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [...PRIMARY, ...SECONDARY].filter(
    (i) => !i.roles || i.roles.some((r) => roles.includes(r)),
  );
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="aw-statbar sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur">
      <div className="flex h-12 items-center gap-3 px-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          {settings.logoDataUrl ? (
            <img src={settings.logoDataUrl} alt="" className="h-7 w-7 rounded object-cover" />
          ) : (
            <div
              className="h-7 w-7 rounded grid place-items-center text-[10px] font-black"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              AE
            </div>
          )}
          <div className="hidden sm:block min-w-0 leading-tight">
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Command</div>
            <div className="truncate text-sm font-semibold">{settings.brandName || "Aegis"}</div>
          </div>
        </Link>

        <div className="hidden xl:flex items-center gap-1 ml-1">
          <HealthChip label="AlertWest" />
          <HealthChip label="OpenSky" />
          <HealthChip label="NWS" />
          <HealthChip label="FIRMS" />
          <HealthChip label="USGS" />
        </div>

        {/* Primary nav (desktop) */}
        <nav className="hidden md:flex items-center gap-0.5 mx-2 overflow-x-auto">
          {items.map((it) => (
            <NavLink key={it.url} item={it} active={isActive(it.url)} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ClockUTC />
          <Link
            to="/settings"
            className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-foreground/80 hover:bg-white/10"
            title="Settings"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Settings</span>
          </Link>
          {loading ? null : userId ? (
            <div className="flex items-center gap-2">
              <div className="hidden md:block text-right leading-tight">
                <div className="text-[11px] text-foreground/90 truncate max-w-[160px]">{email}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {roles.length ? roles.join(" · ") : "no role"}
                </div>
              </div>
              <button
                onClick={signOut}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:brightness-110"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 px-2 py-2 grid grid-cols-2 gap-1">
          {items.map((it) => (
            <Link
              key={it.url}
              to={it.url}
              onClick={() => setMobileOpen(false)}
              className={`inline-flex h-9 items-center gap-2 rounded-md px-2 text-xs font-medium ${
                isActive(it.url)
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
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
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex-1 min-h-0 min-w-0 relative">{children}</main>
    </div>
  );
}
