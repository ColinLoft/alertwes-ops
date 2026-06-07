import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, ShieldCheck, MapPin, Plus, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole, type AppRole } from "@/lib/use-auth";
import { fetchDetectionArea, saveDetectionArea, type DetectionArea } from "@/lib/area";
import { toast } from "sonner";

const ROLES: AppRole[] = ["admin", "dispatcher", "pilot", "maintenance"];

export function AdminSections() {
  const { roles } = useAuth();
  if (!hasRole(roles, "admin")) return null;
  return (
    <>
      <DetectionAreaSection />
      <UsersSection />
    </>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-card/30 backdrop-blur-xl">
      <div className="border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function DetectionAreaSection() {
  const qc = useQueryClient();
  const { data: area } = useQuery<DetectionArea>({
    queryKey: ["detection_area"],
    queryFn: fetchDetectionArea,
  });
  const [local, setLocal] = useState<DetectionArea | null>(null);
  useEffect(() => { if (area) setLocal(area); }, [area]);

  if (!local) return null;
  const upd = (p: Partial<DetectionArea>) => setLocal({ ...local, ...p });
  const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    try {
      await saveDetectionArea({
        center_lat: Number(local.center_lat),
        center_lng: Number(local.center_lng),
        radius_mi: Number(local.radius_mi),
        states: local.states,
        counties: local.counties,
      });
      qc.invalidateQueries({ queryKey: ["detection_area"] });
      toast.success("Detection area saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    }
  };

  return (
    <Card title="Detection area" desc="Incidents and AI camera detections only fire inside this area. A camera qualifies if it's inside the radius OR matches a listed state/county.">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Center lat">
          <input type="number" step="0.001" value={local.center_lat}
            onChange={(e) => upd({ center_lat: Number(e.target.value) })}
            className="w-full rounded-md border border-white/10 bg-background px-2 py-1 text-sm font-mono" />
        </Field>
        <Field label="Center lng">
          <input type="number" step="0.001" value={local.center_lng}
            onChange={(e) => upd({ center_lng: Number(e.target.value) })}
            className="w-full rounded-md border border-white/10 bg-background px-2 py-1 text-sm font-mono" />
        </Field>
        <Field label="Radius (mi)">
          <input type="number" min={0} value={local.radius_mi}
            onChange={(e) => upd({ radius_mi: Number(e.target.value) })}
            className="w-full rounded-md border border-white/10 bg-background px-2 py-1 text-sm font-mono" />
        </Field>
      </div>
      <Field label="States (comma-separated, e.g. CA,OR,WA)">
        <input type="text" value={local.states.join(",")}
          onChange={(e) => upd({ states: csv(e.target.value) })}
          className="w-full rounded-md border border-white/10 bg-background px-2 py-1 text-sm" />
      </Field>
      <Field label="Counties (comma-separated, optional)">
        <input type="text" value={local.counties.join(",")}
          onChange={(e) => upd({ counties: csv(e.target.value) })}
          className="w-full rounded-md border border-white/10 bg-background px-2 py-1 text-sm" />
      </Field>
      <div className="flex items-center gap-2">
        <button onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">
          <MapPin className="h-3.5 w-3.5" /> Save area
        </button>
        <span className="text-[11px] text-muted-foreground">
          Updated {new Date(local.updated_at).toLocaleString()}
        </span>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

interface ProfileRow { user_id: string; email: string | null; display_name: string | null; status: string; created_at: string }
interface RoleRow { user_id: string; role: AppRole }

function UsersSection() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery<ProfileRow[]>({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id,email,display_name,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
  const { data: allRoles = [] } = useQuery<RoleRow[]>({
    queryKey: ["all_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const rolesByUser: Record<string, AppRole[]> = {};
  for (const r of allRoles) {
    (rolesByUser[r.user_id] ??= []).push(r.role);
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["all_profiles"] });
    qc.invalidateQueries({ queryKey: ["all_roles"] });
  };

  const approve = async (uid: string, role: AppRole = "dispatcher") => {
    const { error } = await supabase.rpc("approve_user", { _user_id: uid, _role: role });
    if (error) toast.error(error.message); else { toast.success("Approved"); refresh(); }
  };
  const deny = async (uid: string) => {
    const { error } = await supabase.rpc("deny_user", { _user_id: uid });
    if (error) toast.error(error.message); else { toast.success("Denied"); refresh(); }
  };
  const addRole = async (uid: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message); else { toast.success(`+${role}`); refresh(); }
  };
  const removeRole = async (uid: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    if (error) toast.error(error.message); else refresh();
  };

  return (
    <Card title="Users & roles" desc="Approve new signups and manage operator roles.">
      <div className="overflow-x-auto">
        <table className="cad-table">
          <thead>
            <tr>
              <th>User</th><th>Status</th><th>Roles</th><th>Joined</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const userRoles = rolesByUser[p.user_id] ?? [];
              return (
                <tr key={p.user_id}>
                  <td className="max-w-[200px]">
                    <div className="text-foreground">{p.display_name ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{p.email}</div>
                  </td>
                  <td>
                    <StatusPill status={p.status} />
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {userRoles.map((r) => (
                        <button key={r} onClick={() => removeRole(p.user_id, r)}
                          title="Remove role"
                          className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20">
                          {r} <X className="h-2.5 w-2.5" />
                        </button>
                      ))}
                      {ROLES.filter((r) => !userRoles.includes(r)).length > 0 && (
                        <select
                          onChange={(e) => { if (e.target.value) { addRole(p.user_id, e.target.value as AppRole); e.target.value = ""; } }}
                          className="rounded border border-white/10 bg-background px-1 py-0.5 text-[10px]">
                          <option value="">+ role</option>
                          {ROLES.filter((r) => !userRoles.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-1">
                      {p.status !== "approved" && (
                        <button onClick={() => approve(p.user_id)}
                          className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 text-[10px] hover:bg-emerald-500/25">
                          <Check className="h-3 w-3" /> Approve
                        </button>
                      )}
                      {p.status !== "denied" && (
                        <button onClick={() => deny(p.user_id)}
                          className="inline-flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 px-2 py-0.5 text-[10px] hover:bg-rose-500/25">
                          <X className="h-3 w-3" /> Deny
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {profiles.length === 0 && (
              <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-6">No users yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const c = status === "approved" ? "emerald" : status === "denied" ? "rose" : "amber";
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider border-${c}-500/40 bg-${c}-500/10 text-${c}-300`}>
      {status}
    </span>
  );
}
