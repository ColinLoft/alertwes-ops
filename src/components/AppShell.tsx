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
  Search,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSettings } from "@/lib/settings";
import { useAuth, type AppRole } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  title: string;
  url: string;
  icon: typeof Radar;
  roles?: AppRole[]; // if omitted, visible to all signed-in users
}

const OPS_ITEMS: NavItem[] = [
  { title: "Dispatch", url: "/", icon: Radar },
  { title: "Fleet", url: "/fleet", icon: Plane },
  { title: "Incidents", url: "/incidents", icon: Flame },
  { title: "Bases", url: "/bases", icon: Warehouse },
  { title: "Disaster Response", url: "/disaster", icon: ShieldAlert },
];

const COMPANY_ITEMS: NavItem[] = [
  { title: "Maintenance", url: "/ops/maintenance", icon: Wrench },
  { title: "Personnel", url: "/ops/personnel", icon: Users },
  { title: "Admin", url: "/admin", icon: SettingsIcon, roles: ["admin"] },
];

function NavGroup({ label, items, roles }: { label: string; items: NavItem[]; roles: AppRole[] }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r)));
  if (visible.length === 0) return null;
  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => {
            const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [settings] = useSettings();
  const { roles } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/5">
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
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Command</div>
            <div className="truncate font-semibold leading-tight">
              {settings.brandName || "Aegis"}
            </div>
          </div>
        )}
      </div>
      <SidebarContent>
        <NavGroup label="Operations" items={OPS_ITEMS} roles={roles} />
        <NavGroup label="Company" items={COMPANY_ITEMS} roles={roles} />
      </SidebarContent>
    </Sidebar>
  );
}

function ClockUTC() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const z = now.toISOString().slice(11, 19);
  const local = now.toLocaleTimeString([], { hour12: false });
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
      <span><span className="text-foreground/80">{local}</span> LOCAL</span>
      <span className="opacity-50">|</span>
      <span><span className="text-foreground/80">{z}</span>Z</span>
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
  const { userId, email, roles, loading } = useAuth();
  const signOut = async () => {
    await supabase.auth.signOut();
  };
  return (
    <header className="aw-statbar flex h-12 shrink-0 items-center gap-3 border-b border-white/5 bg-background/40 px-3 backdrop-blur">
      <SidebarTrigger className="h-8 w-8" />
      <div className="hidden md:flex items-center gap-1">
        <HealthChip label="AlertWest" />
        <HealthChip label="OpenSky" />
        <HealthChip label="NWS" />
        <HealthChip label="FIRMS" ok={false} />
        <HealthChip label="NOTAMs" ok={false} />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <ClockUTC />
        <Link
          to="/settings"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-foreground/80 hover:bg-white/10"
          title="Settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
        {loading ? null : userId ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:block text-right leading-tight">
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
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 min-h-0 min-w-0 relative">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
