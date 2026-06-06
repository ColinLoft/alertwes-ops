import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/use-auth";

export const Route = createFileRoute("/ops/personnel")({
  head: () => ({ meta: [{ title: "Personnel — Aegis Command" }] }),
  component: PersonnelPage,
  ssr: false,
});

interface RoleRow {
  user_id: string;
  role: AppRole;
  created_at: string;
}

const ROLE_COLOR: Record<AppRole, string> = {
  admin: "#a78bfa",
  dispatcher: "#3b82f6",
  pilot: "#22c55e",
  maintenance: "#f59e0b",
};

function PersonnelPage() {
  const { userId } = useAuth();
  const { data: rows = [] } = useQuery({
    queryKey: ["personnel_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  // Group by user_id
  const byUser = new Map<string, { roles: AppRole[]; joined: string }>();
  for (const r of rows) {
    const u = byUser.get(r.user_id) ?? { roles: [], joined: r.created_at };
    u.roles.push(r.role);
    if (r.created_at < u.joined) u.joined = r.created_at;
    byUser.set(r.user_id, u);
  }
  const users = Array.from(byUser.entries());

  const tally: Record<AppRole, number> = { admin: 0, dispatcher: 0, pilot: 0, maintenance: 0 };
  for (const [, u] of users) u.roles.forEach((r) => (tally[r] = (tally[r] ?? 0) + 1));

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold tracking-wide">Personnel</h1>
          <p className="text-xs text-muted-foreground">Crew roster & on-call roles</p>
        </div>
        <Link
          to="/admin"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 text-xs hover:bg-white/10"
        >
          <Shield className="h-3.5 w-3.5" /> Manage roles <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(Object.keys(tally) as AppRole[]).map((r) => (
          <div
            key={r}
            className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-3"
          >
            <div
              className="text-[10px] uppercase tracking-[0.18em]"
              style={{ color: ROLE_COLOR[r] }}
            >
              {r}
            </div>
            <div className="mt-1 text-2xl font-bold font-mono">{tally[r]}</div>
          </div>
        ))}
      </div>

      <div className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-white/5">
          Crew · {users.length}
        </div>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Roles</th>
              <th className="text-left p-3">Member since</th>
            </tr>
          </thead>
          <tbody>
            {users.map(([uid, u]) => (
              <tr key={uid} className="border-t border-white/5">
                <td className="p-3 font-mono text-xs">
                  {uid.slice(0, 8)}…{uid.slice(-4)}
                  {uid === userId && (
                    <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                      you
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          borderColor: `${ROLE_COLOR[r]}55`,
                          color: ROLE_COLOR[r],
                          background: `${ROLE_COLOR[r]}14`,
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {new Date(u.joined).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
                  No personnel assigned yet. Grant roles from the Admin page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
