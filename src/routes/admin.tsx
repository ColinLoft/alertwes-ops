import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/use-auth";
import { StubPage } from "@/components/StubPage";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Aegis Command" }] }),
  component: AdminPage,
  ssr: false,
});

const ALL_ROLES: AppRole[] = ["admin", "dispatcher", "pilot", "maintenance"];

interface RoleRow { id: string; user_id: string; role: AppRole; created_at: string }

function AdminPage() {
  const { roles, userId, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const qc = useQueryClient();

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RoleRow[];
    },
    enabled: isAdmin,
  });

  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("dispatcher");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!userId) {
    return (
      <StubPage
        title="Sign in required"
        blurb="The Admin page is only available to signed-in administrators."
      />
    );
  }

  // Self-promote helper: when zero admins exist anywhere, allow the first
  // signed-in user to claim admin so the system can be bootstrapped.
  const claimFirstAdmin = async () => {
    setBusy(true);
    try {
      const { count } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) > 0) {
        toast.error("An admin already exists. Ask them to grant you the role.");
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
        toast.success("You are now the first administrator.");
        await qc.invalidateQueries({ queryKey: ["user_roles"] });
        // Force a soft reload so useAuth picks up the new role
        window.location.reload();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to claim admin");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-md">
        <div className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="mt-2 text-lg font-semibold">Admin access required</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask an administrator to grant you the <code>admin</code> role. If this is a fresh deployment and no admins exist yet, you can claim the role below.
          </p>
          <button
            onClick={claimFirstAdmin}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            <Shield className="h-3.5 w-3.5" /> Claim first admin
          </button>
        </div>
      </div>
    );
  }

  const grant = async () => {
    if (!newUserId.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: newUserId.trim(), role: newRole });
      if (error) throw error;
      toast.success(`Granted ${newRole}`);
      setNewUserId("");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Revoked");
    refetch();
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-5 max-w-3xl">
      <h1 className="text-lg font-semibold tracking-wide">Admin</h1>
      <p className="text-xs text-muted-foreground">Manage role assignments</p>

      <div className="mt-4 aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Grant role</div>
        <div className="flex flex-wrap gap-2">
          <input
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="User UUID (from Supabase Auth)"
            className="flex-1 min-w-[260px] rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-mono"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AppRole)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm"
          >
            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={grant}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" /> Grant
          </button>
        </div>
      </div>

      <div className="mt-4 aw-panel rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left p-3">User ID</th><th className="text-left p-3">Role</th><th className="text-left p-3">Granted</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 font-mono text-xs">{r.user_id}</td>
                <td className="p-3"><span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">{r.role}</span></td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3 text-right">
                  <button onClick={() => revoke(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No role assignments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
