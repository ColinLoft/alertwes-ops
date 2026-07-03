import { X, Wind, Thermometer, Droplets, RefreshCw, Flame, Plane, Plus, Battery, MapPin, Send } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMission } from "@/lib/mission-store";
import {
  fetchIncidents,
  fetchIncidentEvents,
  updateIncidentStatus,
  createIncidentFromHotspot,
  PRIORITY_META,
  STATUS_META,
  type IncidentStatus,
  type IncidentRow,
} from "@/lib/incidents";
import { fetchDrones, STATUS_META as DRONE_META, type DroneRow } from "@/lib/drones";
import { DispatchPanel } from "@/components/DispatchPanel";
import { CameraPanel } from "@/components/CameraPanel";
import { getWindAtPoint } from "@/lib/synoptic.functions";
import { useCameraHistory } from "@/hooks/useCameraHistory";
import type { Camera } from "@/lib/alertwest";

export function Inspector({ cameras }: { cameras: Camera[] }) {
  const sel = useMission((s) => s.selection);
  const clear = useMission((s) => s.clear);
  if (!sel.kind) return null;

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 bottom-0 z-[1045] flex w-[380px] flex-col border-l border-white/10 bg-black/75 shadow-2xl backdrop-blur-xl">
      {sel.kind === "incident" && sel.id && <IncidentInspector id={sel.id} onClose={clear} />}
      {sel.kind === "camera" && sel.id && <CameraInspectorWrap cameras={cameras} id={sel.id} onClose={clear} />}
      {sel.kind === "aircraft" && sel.id && <AircraftInspector id={sel.id} onClose={clear} />}
      {sel.kind === "hotspot" && <HotspotInspector payload={sel.payload} onClose={clear} />}
      {sel.kind === "plane" && <PlaneInspector payload={sel.payload} onClose={clear} />}
    </aside>
  );
}

/* ---------------- Incident ---------------- */

function IncidentInspector({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const windFn = useServerFn(getWindAtPoint);
  const { data: rows = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 30_000 });
  const inc = rows.find((r) => r.id === id) ?? null;
  const { data: events = [] } = useQuery({ queryKey: ["incident_events", id], queryFn: () => fetchIncidentEvents(id), enabled: !!inc });
  const { data: wind, isFetching: windLoading, refetch: refetchWind } = useQuery({
    queryKey: ["wind", inc ? Math.round(inc.lat * 10) / 10 : 0, inc ? Math.round(inc.lng * 10) / 10 : 0],
    queryFn: () => windFn({ data: { lat: inc!.lat, lng: inc!.lng } }),
    enabled: !!inc, refetchInterval: 15 * 60_000, refetchOnWindowFocus: false, retry: false,
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!inc) return <Header title="Incident" onClose={onClose} subtitle="Not found" />;

  const sm = STATUS_META[inc.status]; const pm = PRIORITY_META[inc.priority]; const obs = wind?.obs;

  const submitNote = async () => {
    const text = note.trim(); if (!text) return;
    setSaving(true);
    const { error } = await supabase.from("incident_events").insert({ incident_id: id, event_type: "note", message: text });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNote(""); toast.success("Note added"); qc.invalidateQueries({ queryKey: ["incident_events", id] });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start gap-2 border-b border-white/10 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${pm.color}22`, color: pm.color, border: `1px solid ${pm.color}66` }}>{pm.label}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: sm.color }}>{sm.label}</span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold">{inc.title}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{inc.lat.toFixed(4)}, {inc.lng.toFixed(4)} · {inc.county ?? "—"}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <Section title="Workflow">
        <div className="grid grid-cols-2 gap-1.5">
          {(["triaging","dispatched","onscene","contained","closed","false_positive"] as IncidentStatus[]).map((s) => (
            <button key={s} onClick={async () => { try { await updateIncidentStatus(id, s); toast.success(`Status → ${STATUS_META[s].label}`); qc.invalidateQueries({ queryKey: ["incidents"] }); } catch (e: any) { toast.error(e?.message ?? "Failed"); } }}
              disabled={s === inc.status}
              className="rounded border border-white/10 px-2 py-1.5 text-[11px] hover:bg-white/5 disabled:opacity-40"
              style={s === inc.status ? { borderColor: STATUS_META[s].color, color: STATUS_META[s].color } : undefined}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="On-Scene Weather" right={<button onClick={() => refetchWind()} className="text-muted-foreground hover:text-foreground"><RefreshCw className={`h-3 w-3 ${windLoading ? "animate-spin" : ""}`} /></button>}>
        {!obs ? (
          <div className="text-xs text-muted-foreground">{wind?.error ? `No data: ${wind.error}` : "Loading station…"}</div>
        ) : (
          <div>
            <div className="mb-2 text-[11px] text-muted-foreground">{obs.name} ({obs.station}) · {obs.distance_mi.toFixed(1)} mi</div>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Wind className="h-3 w-3" />} label="Wind" value={obs.wind_speed_mph != null ? `${obs.wind_speed_mph.toFixed(0)} mph` : "—"} sub={obs.wind_dir_deg != null ? `${Math.round(obs.wind_dir_deg)}°` : ""} />
              <Stat icon={<Wind className="h-3 w-3" />} label="Gust" value={obs.wind_gust_mph != null ? `${obs.wind_gust_mph.toFixed(0)} mph` : "—"} />
              <Stat icon={<Thermometer className="h-3 w-3" />} label="Temp" value={obs.temp_f != null ? `${obs.temp_f.toFixed(0)}°F` : "—"} />
              <Stat icon={<Droplets className="h-3 w-3" />} label="RH" value={obs.rh_pct != null ? `${obs.rh_pct.toFixed(0)}%` : "—"} />
            </div>
          </div>
        )}
      </Section>

      <DispatchPanel incident={inc} />

      <Section title="Quick Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Observation, ops update, mission detail…"
          className="w-full resize-y rounded-md border border-white/10 bg-background px-2 py-1.5 text-xs" />
        <div className="mt-1 flex justify-end">
          <button onClick={submitNote} disabled={saving || !note.trim()}
            className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
            {saving ? "Saving…" : "Add note"}
          </button>
        </div>
      </Section>

      <Section title="Timeline">
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground">No events yet.</div>
        ) : (
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="border-l border-white/10 pl-2 text-[11px]">
                <div className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</div>
                <div className="whitespace-pre-wrap text-foreground">{e.message ?? e.event_type}</div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

/* ---------------- Camera ---------------- */

function CameraInspectorWrap({ cameras, id, onClose }: { cameras: Camera[]; id: string; onClose: () => void }) {
  const cam = cameras.find((c) => c.site.id === id) ?? null;
  const history = useCameraHistory(cameras, Date.now());
  return <CameraPanel camera={cam} onClose={onClose} history={history[id] ?? []} />;
}

/* ---------------- Aircraft (fleet drone) ---------------- */

function AircraftInspector({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: rows = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones, refetchInterval: 60_000 });
  const d = rows.find((r) => r.id === id) ?? null;
  if (!d) return <Header title="Aircraft" onClose={onClose} subtitle="Not found" />;
  const sm = DRONE_META[d.status];
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start gap-2 border-b border-white/10 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{d.tail_number}</span>
            <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: sm.color }}>{sm.label}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{d.airframe?.manufacturer} {d.airframe?.model}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <Section title="Telemetry">
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={<Battery className="h-3 w-3" />} label="Battery" value={`${d.battery_pct}%`} />
          <Stat icon={<Wind className="h-3 w-3" />} label="Retardant" value={`${d.retardant_l} L`} />
          <Stat icon={<MapPin className="h-3 w-3" />} label="Base" value={d.base?.code ?? "—"} />
          <Stat icon={<Plane className="h-3 w-3" />} label="Range" value={d.airframe ? `${d.airframe.range_mi} mi` : "—"} />
          <Stat icon={<Plane className="h-3 w-3" />} label="Cruise" value={d.airframe ? `${d.airframe.cruise_speed_mph} mph` : "—"} />
          <Stat icon={<Wind className="h-3 w-3" />} label="Hours" value={`${d.flight_hours.toFixed(1)}`} />
        </div>
        {d.last_lat != null && d.last_lng != null && (
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">Last: {d.last_lat.toFixed(4)}, {d.last_lng.toFixed(4)}{d.heading_deg != null ? ` · ${Math.round(d.heading_deg)}°` : ""}</div>
        )}
      </Section>

      <Section title="Actions">
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <button onClick={() => toast.info("Assign from an incident's Dispatch panel")} className="rounded border border-white/10 px-2 py-1.5 hover:bg-white/5">Assign to call</button>
          <button onClick={() => toast.info("Mission planner coming soon")} className="rounded border border-white/10 px-2 py-1.5 hover:bg-white/5">Plan mission</button>
        </div>
      </Section>

      {d.notes && <Section title="Notes"><div className="whitespace-pre-wrap text-[11px] text-muted-foreground">{d.notes}</div></Section>}
    </div>
  );
}

/* ---------------- Hotspot (FIRMS) ---------------- */

function HotspotInspector({ payload, onClose }: { payload: any; onClose: () => void }) {
  const h = payload ?? {};
  const [busy, setBusy] = useState(false);
  const clear = useMission((s) => s.clear);
  const promote = async () => {
    setBusy(true);
    try {
      const row = await createIncidentFromHotspot({ lat: h.lat, lng: h.lng, frp: h.frp ?? 0, confidence: h.confidence ?? "", source: "firms" });
      toast.success("Incident opened");
      useMission.getState().select({ kind: "incident", id: row.id });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start gap-2 border-b border-white/10 p-3">
        <div className="flex-1">
          <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400" /><span className="text-sm font-semibold">FIRMS Hotspot</span></div>
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{h.lat?.toFixed?.(4)}, {h.lng?.toFixed?.(4)}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <Section title="Detection">
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={<Flame className="h-3 w-3" />} label="FRP" value={typeof h.frp === "number" ? `${h.frp.toFixed(1)} MW` : "—"} />
          <Stat icon={<Flame className="h-3 w-3" />} label="Confidence" value={h.confidence === "h" ? "High" : h.confidence === "n" ? "Nominal" : h.confidence === "l" ? "Low" : (h.confidence || "—")} />
        </div>
      </Section>
      <Section title="Action">
        <button onClick={promote} disabled={busy} className="inline-flex w-full items-center justify-center gap-1 rounded bg-primary px-2 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" /> Open incident
        </button>
      </Section>
    </div>
  );
}

/* ---------------- Plane (ADS-B) ---------------- */

function PlaneInspector({ payload, onClose }: { payload: any; onClose: () => void }) {
  const p = payload ?? {};
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start gap-2 border-b border-white/10 p-3">
        <div className="flex-1">
          <div className="flex items-center gap-2"><Plane className="h-4 w-4 text-amber-300" /><span className="text-sm font-semibold">{p.callsign ?? p.icao24 ?? "Aircraft"}</span></div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{p.origin_country ?? "—"}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <Section title="Telemetry">
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={<Plane className="h-3 w-3" />} label="Altitude" value={p.baro_altitude != null ? `${Math.round(p.baro_altitude * 3.281)} ft` : "—"} />
          <Stat icon={<Send className="h-3 w-3" />} label="Speed" value={p.velocity != null ? `${Math.round(p.velocity * 1.944)} kt` : "—"} />
          <Stat icon={<Send className="h-3 w-3" />} label="Track" value={p.true_track != null ? `${Math.round(p.true_track)}°` : "—"} />
          <Stat icon={<Send className="h-3 w-3" />} label="Vert Rate" value={p.vertical_rate != null ? `${Math.round(p.vertical_rate * 196.85)} fpm` : "—"} />
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">{p.latitude?.toFixed?.(4)}, {p.longitude?.toFixed?.(4)} · ICAO {p.icao24}</div>
      </Section>
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="border-b border-white/10 p-3">
      <div className="mb-2 flex items-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </div>
  );
}

function Header({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-2 border-b border-white/10 p-3">
      <div className="flex-1"><div className="text-sm font-semibold">{title}</div>{subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}</div>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">{icon} {label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
