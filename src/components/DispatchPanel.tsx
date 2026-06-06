import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Plane, Battery, Droplets, Gauge, AlertTriangle, X as XIcon, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchDrones, STATUS_META as DRONE_STATUS } from "@/lib/drones";
import {
  rankCandidates,
  assignDroneToIncident,
  releaseDroneFromIncident,
  markDroneInflight,
} from "@/lib/dispatch";
import type { IncidentRow } from "@/lib/incidents";

export function DispatchPanel({ incident }: { incident: IncidentRow }) {
  const qc = useQueryClient();
  const { data: drones = [], isLoading } = useQuery({
    queryKey: ["drones"],
    queryFn: fetchDrones,
    refetchInterval: 15_000,
  });

  const ranked = rankCandidates(drones, incident);
  const assigned = drones.find((d) => d.id === incident.assigned_drone_id) ?? null;
  const assignedCand = assigned ? ranked.find((c) => c.drone.id === assigned.id) : null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["drones"] });
    qc.invalidateQueries({ queryKey: ["incidents"] });
    qc.invalidateQueries({ queryKey: ["incident_events", incident.id] });
  };

  const onAssign = async (droneId: string, eta: number, dist: number) => {
    try {
      await assignDroneToIncident(incident.id, droneId, eta, dist);
      toast.success("Drone dispatched");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Dispatch failed");
    }
  };

  const onRelease = async () => {
    try {
      await releaseDroneFromIncident(incident.id, incident.assigned_drone_id);
      toast.success("Drone released");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const onLaunch = async () => {
    if (!incident.assigned_drone_id) return;
    try {
      await markDroneInflight(incident.assigned_drone_id, incident.id);
      toast.success("Drone in-flight");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="p-3 border-b border-white/10 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Dispatch</div>

      {assigned && (
        <div className="rounded-md border border-primary/40 bg-primary/10 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <Plane className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold">{assigned.tail_number}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: DRONE_STATUS[assigned.status].color }}>
              {DRONE_STATUS[assigned.status].label}
            </span>
            <button onClick={onRelease} className="ml-auto text-muted-foreground hover:text-foreground" title="Release">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {assignedCand && (
            <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
              <span><Gauge className="inline h-3 w-3" /> {assignedCand.distance_mi.toFixed(1)} mi</span>
              <span>ETA {assignedCand.eta_min.toFixed(0)} min</span>
              <span><Battery className="inline h-3 w-3" /> {assigned.battery_pct}%</span>
            </div>
          )}
          {assigned.status === "preflight" && (
            <button
              onClick={onLaunch}
              className="w-full inline-flex items-center justify-center gap-1 rounded bg-orange-500 px-2 py-1.5 text-[11px] font-semibold text-black hover:brightness-110"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Launch
            </button>
          )}
        </div>
      )}

      {!assigned && (
        <>
          {isLoading && <div className="text-xs text-muted-foreground">Loading fleet…</div>}
          {!isLoading && ranked.length === 0 && (
            <div className="text-xs text-muted-foreground">No drones in fleet.</div>
          )}
          {ranked.slice(0, 5).map((c) => {
            const eligible = c.ready && c.in_range && c.battery_ok;
            return (
              <div
                key={c.drone.id}
                className={`rounded border p-2 space-y-1 ${eligible ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 bg-white/[0.02] opacity-70"}`}
              >
                <div className="flex items-center gap-2">
                  <Plane className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{c.drone.tail_number}</span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: DRONE_STATUS[c.drone.status].color }}>
                    {DRONE_STATUS[c.drone.status].label}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">{c.drone.base?.code ?? "—"}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                  <span><Gauge className="inline h-3 w-3" /> {isFinite(c.distance_mi) ? `${c.distance_mi.toFixed(0)} mi` : "—"}</span>
                  <span>ETA {isFinite(c.eta_min) ? `${c.eta_min.toFixed(0)}m` : "—"}</span>
                  <span><Battery className="inline h-3 w-3" /> {c.drone.battery_pct}%</span>
                  <span><Droplets className="inline h-3 w-3" /> {Number(c.drone.retardant_l).toFixed(0)}L</span>
                </div>
                {c.reasons.length > 0 && (
                  <div className="flex items-start gap-1 text-[10px] text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> <span>{c.reasons.join(" · ")}</span>
                  </div>
                )}
                <button
                  disabled={!eligible}
                  onClick={() => onAssign(c.drone.id, c.eta_min, c.distance_mi)}
                  className="w-full inline-flex items-center justify-center gap-1 rounded bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-3 w-3" /> Dispatch
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
