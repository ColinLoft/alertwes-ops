import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wrench, Plus, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchDrones, type DroneRow } from "@/lib/drones";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/ops/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Aegis Command" }] }),
  component: MaintenancePage,
  ssr: false,
});

type LogKind = "scheduled" | "unscheduled" | "inspection";

interface MaintLog {
  id: string;
  drone_id: string;
  kind: LogKind;
  description: string;
  hours_at: number | null;
  performed_by: string | null;
  created_at: string;
  drone?: { tail_number: string } | null;
}

const KIND_META: Record<LogKind, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "#22c55e" },
  unscheduled: { label: "Unscheduled", color: "#ef4444" },
  inspection: { label: "Inspection", color: "#3b82f6" },
};

function MaintenancePage() {
  const qc = useQueryClient();
  const { roles, userId } = useAuth();
  const canEdit = roles.includes("admin") || roles.includes("maintenance");

  const dronesQ = useQuery({ queryKey: ["drones"], queryFn: fetchDrones });
  const logsQ = useQuery({
    queryKey: ["maintenance_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_logs")
        .select("id, drone_id, kind, description, hours_at, performed_by, created_at, drone:drones(tail_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as MaintLog[];
    },
  });

  const drones = dronesQ.data ?? [];
  const logs = logsQ.data ?? [];

  const [droneId, setDroneId] = useState("");
  const [kind, setKind] = useState<LogKind>("scheduled");
  const [desc, setDesc] = useState("");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);

  const upcoming = useMemo(
    () =>
      drones
        .filter((d) => d.next_service_at)
        .sort((a, b) => +new Date(a.next_service_at!) - +new Date(b.next_service_at!))
        .slice(0, 5),
    [drones],
  );

  const submit = async () => {
    if (!droneId || !desc.trim()) return toast.error("Pick a drone and add a description.");
    setBusy(true);
    try {
      const { error } = await supabase.from("maintenance_logs").insert({
        drone_id: droneId,
        kind,
        description: desc.trim(),
        hours_at: hours ? Number(hours) : null,
        performed_by: userId,
      });
      if (error) throw error;
      toast.success("Maintenance log added");
      setDesc("");
      setHours("");
      qc.invalidateQueries({ queryKey: ["maintenance_logs"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <Wrench className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold tracking-wide">Maintenance</h1>
          <p className="text-xs text-muted-foreground">Airframe service history & upcoming work</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Entry form */}
        <div className="xl:col-span-1 space-y-4">
          {canEdit ? (
            <div className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="h-4 w-4 text-primary" />
                <div className="text-sm font-semibold">Log entry</div>
              </div>
              <div className="space-y-2">
                <select
                  value={droneId}
                  onChange={(e) => setDroneId(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-sm"
                >
                  <option value="">Select drone…</option>
                  {drones.map((d: DroneRow) => (
                    <option key={d.id} value={d.id}>
                      {d.tail_number} — {d.airframe?.model ?? "—"}
                    </option>
                  ))}
                </select>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as LogKind)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-sm"
                >
                  {Object.entries(KIND_META).map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </select>
                <input
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="Airframe hours (optional)"
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-sm font-mono"
                />
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe the work performed…"
                  className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-2 text-sm"
                />
                <button
                  onClick={submit}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Add log"}
                </button>
              </div>
            </div>
          ) : (
            <div className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 mb-1 text-amber-400" />
              Only users with the <code>maintenance</code> or <code>admin</code> role can add log entries.
            </div>
          )}

          <div className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">Next service due</div>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-xs text-muted-foreground">No scheduled services.</div>
            ) : (
              <ul className="space-y-1.5">
                {upcoming.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{d.tail_number}</span>
                    <span className="text-muted-foreground">
                      {new Date(d.next_service_at!).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Log list */}
        <div className="xl:col-span-2 aw-panel rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-b border-white/5">
            History · {logs.length}
          </div>
          <div className="divide-y divide-white/5">
            {logs.map((l) => {
              const meta = KIND_META[l.kind];
              return (
                <div key={l.id} className="p-3 flex gap-3">
                  <span
                    className="shrink-0 mt-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}14` }}
                  >
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold">{l.drone?.tail_number ?? "—"}</span>
                      {l.hours_at != null && (
                        <span className="text-muted-foreground">@ {l.hours_at}h</span>
                      )}
                      <span className="ml-auto text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm">{l.description}</div>
                  </div>
                </div>
              );
            })}
            {logs.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No maintenance logs yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
