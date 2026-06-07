import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, RefreshCw, Wind, Thermometer, Droplets, AlertTriangle, X, Plus, Sparkles, Check, Eye, VolumeX } from "lucide-react";
import { DispatchPanel } from "@/components/DispatchPanel";
import { supabase } from "@/integrations/supabase/client";
import { getFirmsHotspots } from "@/lib/firms.functions";
import { getRedFlagAlerts } from "@/lib/nws.functions";
import { getWindAtPoint } from "@/lib/synoptic.functions";
import { sweepCameras } from "@/lib/ai-detect.functions";
import { fetchCameras, type Camera } from "@/lib/alertwest";
import { fetchDetectionArea, isInDetectionArea } from "@/lib/area";
import { fetchPendingSuggestions, dismissSuggestion, promoteSuggestion, type SuggestionRow } from "@/lib/suggestions";
import {
  fetchIncidents,
  fetchIncidentEvents,
  createIncidentFromHotspot,
  updateIncidentStatus,
  PRIORITY_META,
  STATUS_META,
  type IncidentRow,
  type IncidentStatus,
} from "@/lib/incidents";

export const Route = createFileRoute("/incidents")({
  head: () => ({ meta: [{ title: "CAD — Aegis Command" }] }),
  component: IncidentsPage,
  ssr: false,
});

function IncidentsPage() {
  const qc = useQueryClient();
  const firmsFn = useServerFn(getFirmsHotspots);
  const nwsFn = useServerFn(getRedFlagAlerts);
  const windFn = useServerFn(getWindAtPoint);
  const sweepFn = useServerFn(sweepCameras);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [sweeping, setSweeping] = useState(false);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("cad-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => qc.invalidateQueries({ queryKey: ["incidents"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_events" }, () => qc.invalidateQueries({ queryKey: ["incident_events"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_suggestions" }, () => qc.invalidateQueries({ queryKey: ["suggestions"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 30_000 });
  const { data: firms } = useQuery({ queryKey: ["firms"], queryFn: () => firmsFn(), refetchInterval: 15 * 60_000, staleTime: 10 * 60_000 });
  const { data: nws } = useQuery({ queryKey: ["nws-redflag"], queryFn: () => nwsFn(), refetchInterval: 5 * 60_000, staleTime: 60_000 });
  const { data: area } = useQuery({ queryKey: ["detection_area"], queryFn: fetchDetectionArea });
  const { data: suggestions = [] } = useQuery({ queryKey: ["suggestions"], queryFn: fetchPendingSuggestions, refetchInterval: 30_000 });
  const { data: cameras = [] } = useQuery({ queryKey: ["aw-cameras"], queryFn: fetchCameras, staleTime: 5 * 60_000 });

  const hotspots = firms?.hotspots ?? [];
  const redFlagCount = nws?.alerts?.length ?? 0;

  const visible = useMemo(() => {
    if (statusFilter === "all") return incidents;
    return incidents.filter((i) => !["closed", "false_positive"].includes(i.status));
  }, [incidents, statusFilter]);

  const selected = useMemo(() => incidents.find((i) => i.id === selectedId) ?? null, [incidents, selectedId]);

  const runSweep = async () => {
    if (!area) return toast.error("Detection area not loaded");
    const candidates: Camera[] = cameras.filter((c) => {
      if (!c.image.url || !c.image.time) return false;
      const lat = Number(c.site.latitude), lng = Number(c.site.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return false;
      const ageMin = (Date.now() - new Date(c.image.time).getTime()) / 60000;
      if (ageMin > 120) return false;
      return isInDetectionArea({ lat, lng, state: c.site.state, county: c.site.county }, area);
    });
    const top = candidates.slice(0, 10);
    if (top.length === 0) return toast.error("No in-area cameras with recent frames");
    setSweeping(true);
    toast.message(`AI sweeping ${top.length} cameras…`);
    try {
      const res = await sweepFn({
        data: {
          cameras: top.map((c) => ({
            camera_id: c.site.id,
            camera_name: c.name,
            image_url: c.image.url!,
            image_time: c.image.time!,
            lat: Number(c.site.latitude),
            lng: Number(c.site.longitude),
            state: c.site.state,
            county: c.site.county,
          })),
        },
      });
      toast.success(`Analyzed ${res.analyzed} · ${res.created} new suggestion(s)`);
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Sweep failed");
    } finally { setSweeping(false); }
  };

  const promoteHotspot = async (lat: number, lng: number, frp: number, conf: string) => {
    if (area && !isInDetectionArea({ lat, lng }, area)) {
      toast.error("Hotspot is outside detection area");
      return;
    }
    try {
      const row = await createIncidentFromHotspot({ lat, lng, frp, confidence: conf, source: "firms" });
      setSelectedId(row.id);
      toast.success("Incident opened");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const onPromoteSug = async (s: SuggestionRow) => {
    try {
      const id = await promoteSuggestion(s);
      setSelectedId(id);
      toast.success("Incident opened from camera detection");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-44px)] overflow-hidden">
      {/* Triage strip */}
      <TriageStrip suggestions={suggestions} onPromote={onPromoteSug} onDismiss={async (id) => {
        await dismissSuggestion(id); qc.invalidateQueries({ queryKey: ["suggestions"] });
      }} onSweep={runSweep} sweeping={sweeping} />

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-white/10 glass-subtle flex items-center gap-3 text-[11px]">
        <span className="uppercase tracking-[0.18em] text-muted-foreground">Active Calls</span>
        <span className="font-mono">{visible.length}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground">FIRMS 24h: <span className="font-mono text-foreground">{hotspots.length}</span></span>
          <span className="text-muted-foreground">Red Flag: <span className="font-mono text-foreground">{redFlagCount}</span>{redFlagCount > 0 && <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-400" />}</span>
          <div className="flex gap-1 ml-2">
            <FilterPill on={statusFilter === "active"} onClick={() => setStatusFilter("active")}>Active</FilterPill>
            <FilterPill on={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</FilterPill>
          </div>
        </div>
      </div>

      {/* Active Incidents table */}
      <div className="overflow-auto border-b border-white/10 max-h-[36%]">
        <table className="cad-table">
          <thead>
            <tr>
              <th>Pr</th><th>Nature</th><th>Location</th><th>County</th><th>Status</th><th>Time</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} className="text-center text-xs text-muted-foreground py-8">No active calls. Click "AI Sweep" or a FIRMS hotspot below to open one.</td></tr>
            )}
            {visible.map((i) => {
              const sm = STATUS_META[i.status]; const pm = PRIORITY_META[i.priority];
              return (
                <tr key={i.id} onClick={() => setSelectedId(i.id)} className={i.id === selectedId ? "is-selected" : ""}>
                  <td><span className="font-bold" style={{ color: pm.color }}>{pm.label}</span></td>
                  <td className="font-medium text-foreground" style={{ color: sm.color }}>{i.title}</td>
                  <td className="font-mono text-[10.5px]">{i.lat.toFixed(3)}, {i.lng.toFixed(3)}</td>
                  <td className="text-muted-foreground">{i.county ?? "—"}</td>
                  <td><span style={{ color: sm.color }}>{sm.label}</span></td>
                  <td className="font-mono text-muted-foreground">{timeAgo(i.discovered_at)}</td>
                  <td className="text-muted-foreground uppercase text-[10px]">{i.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Map + detail split */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative min-w-0">
          <MapContainer center={area ? [Number(area.center_lat), Number(area.center_lng)] : [37.5, -119]} zoom={6} className="absolute inset-0" preferCanvas>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {hotspots.map((h, idx) => (
              <CircleMarker key={`h${idx}`} center={[h.lat, h.lng]} radius={Math.min(10, 3 + (h.frp || 0) / 10)}
                pathOptions={{
                  color: h.confidence === "h" ? "#ef4444" : h.confidence === "n" ? "#f97316" : "#fbbf24",
                  fillColor: h.confidence === "h" ? "#ef4444" : h.confidence === "n" ? "#f97316" : "#fbbf24",
                  fillOpacity: 0.55, weight: 1,
                }}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" /> FIRMS hotspot</div>
                    <div className="font-mono">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</div>
                    <div>FRP: {h.frp.toFixed(1)} MW · Conf: {h.confidence || "?"}</div>
                    {area && !isInDetectionArea({ lat: h.lat, lng: h.lng }, area) ? (
                      <div className="text-amber-400">Outside detection area</div>
                    ) : (
                      <button onClick={() => promoteHotspot(h.lat, h.lng, h.frp, h.confidence)}
                        className="mt-1 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">
                        <Plus className="h-3 w-3" /> Open incident
                      </button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
            {incidents.map((i) => (
              <Marker key={i.id} position={[i.lat, i.lng]} icon={incidentIcon(STATUS_META[i.status].color, PRIORITY_META[i.priority].color)}
                eventHandlers={{ click: () => setSelectedId(i.id) }}>
                <Popup><div className="text-xs"><div className="font-semibold">{i.title}</div><div>{STATUS_META[i.status].label} · {PRIORITY_META[i.priority].label}</div></div></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {selected && (
          <IncidentDetail key={selected.id} incident={selected} onClose={() => setSelectedId(null)}
            onStatusChange={async (s) => {
              try { await updateIncidentStatus(selected.id, s); toast.success(`Status → ${STATUS_META[s].label}`); }
              catch (e: any) { toast.error(e?.message ?? "Failed"); }
            }} windFn={windFn} />
        )}
      </div>
    </div>
  );
}

function FilterPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${on ? "bg-primary/20 text-primary border border-primary/40" : "border border-white/10 text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function TriageStrip({ suggestions, onPromote, onDismiss, onSweep, sweeping }: {
  suggestions: SuggestionRow[];
  onPromote: (s: SuggestionRow) => void;
  onDismiss: (id: string) => void;
  onSweep: () => void;
  sweeping: boolean;
}) {
  return (
    <div className="border-b border-white/10 glass-subtle">
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AI Triage</div>
        <span className="text-[11px] text-muted-foreground">{suggestions.length} pending</span>
        <button onClick={onSweep} disabled={sweeping}
          className="ml-auto inline-flex items-center gap-1.5 rounded bg-primary/15 border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/25 disabled:opacity-50">
          <Eye className={`h-3 w-3 ${sweeping ? "animate-pulse" : ""}`} /> {sweeping ? "Analyzing…" : "Run AI sweep"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {suggestions.map((s) => (
            <div key={s.id} className="shrink-0 w-[260px] rounded-lg border border-white/10 bg-white/[0.04] overflow-hidden">
              {s.image_url && <img src={s.image_url} alt="" className="w-full h-[100px] object-cover" />}
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.label === "fire" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {s.label}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{s.confidence}%</span>
                  <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[100px]">{s.camera_name}</span>
                </div>
                {s.reasoning && <div className="text-[10.5px] text-muted-foreground line-clamp-2">{s.reasoning}</div>}
                <div className="flex gap-1 pt-1">
                  <button onClick={() => onPromote(s)} className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-primary text-primary-foreground px-2 py-1 text-[10px] font-semibold hover:brightness-110">
                    <Check className="h-3 w-3" /> Promote
                  </button>
                  <button onClick={() => onDismiss(s.id)} className="inline-flex items-center justify-center rounded border border-white/10 px-2 py-1 text-[10px] hover:bg-white/5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncidentDetail({ incident, onClose, onStatusChange, windFn }: {
  incident: IncidentRow;
  onClose: () => void;
  onStatusChange: (s: IncidentStatus) => void;
  windFn: (args: { data: { lat: number; lng: number } }) => Promise<{ obs: any; error?: string }>;
}) {
  const { data: events = [] } = useQuery({ queryKey: ["incident_events", incident.id], queryFn: () => fetchIncidentEvents(incident.id) });
  const { data: wind, isFetching: windLoading, refetch: refetchWind } = useQuery({
    queryKey: ["wind", incident.id],
    queryFn: () => windFn({ data: { lat: incident.lat, lng: incident.lng } }),
    refetchInterval: 60_000, staleTime: 30_000,
  });

  const sm = STATUS_META[incident.status]; const pm = PRIORITY_META[incident.priority]; const obs = wind?.obs;

  return (
    <aside className="w-[360px] shrink-0 flex flex-col border-l border-white/10 glass overflow-y-auto">
      <div className="p-3 border-b border-white/10 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${pm.color}22`, color: pm.color, border: `1px solid ${pm.color}66` }}>{pm.label}</span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: sm.color }}>{sm.label}</span>
          </div>
          <div className="mt-1 text-sm font-semibold truncate">{incident.title}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="p-3 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Workflow</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(["triaging","dispatched","onscene","contained","closed","false_positive"] as IncidentStatus[]).map((s) => (
            <button key={s} onClick={() => onStatusChange(s)} disabled={s === incident.status}
              className="rounded border border-white/10 px-2 py-1.5 text-[11px] hover:bg-white/5 disabled:opacity-40"
              style={s === incident.status ? { borderColor: STATUS_META[s].color, color: STATUS_META[s].color } : undefined}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">On-Scene Weather</div>
          <button onClick={() => refetchWind()} className="text-muted-foreground hover:text-foreground"><RefreshCw className={`h-3 w-3 ${windLoading ? "animate-spin" : ""}`} /></button>
        </div>
        {!obs ? (
          <div className="text-xs text-muted-foreground">{wind?.error ? `No data: ${wind.error}` : "Loading station…"}</div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground">{obs.name} ({obs.station}) · {obs.distance_mi.toFixed(1)} mi</div>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Wind className="h-3 w-3" />} label="Wind" value={obs.wind_speed_mph != null ? `${obs.wind_speed_mph.toFixed(0)} mph` : "—"} sub={obs.wind_dir_deg != null ? `${Math.round(obs.wind_dir_deg)}°` : ""} />
              <Stat icon={<Wind className="h-3 w-3" />} label="Gust" value={obs.wind_gust_mph != null ? `${obs.wind_gust_mph.toFixed(0)} mph` : "—"} />
              <Stat icon={<Thermometer className="h-3 w-3" />} label="Temp" value={obs.temp_f != null ? `${obs.temp_f.toFixed(0)}°F` : "—"} />
              <Stat icon={<Droplets className="h-3 w-3" />} label="RH" value={obs.rh_pct != null ? `${obs.rh_pct.toFixed(0)}%` : "—"} />
            </div>
          </div>
        )}
      </div>

      <DispatchPanel incident={incident} />

      <div className="p-3 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Timeline</div>
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground">No events yet.</div>
        ) : (
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="text-[11px] border-l border-white/10 pl-2">
                <div className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</div>
                <div className="text-foreground">{e.message ?? e.event_type}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">{icon} {label}</div>
      <div className="mt-0.5 text-sm font-mono">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function incidentIcon(statusColor: string, priorityColor: string) {
  return L.divIcon({
    className: "", iconSize: [22, 22], iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${statusColor};box-shadow:0 0 0 2px ${priorityColor},0 0 12px ${statusColor}aa;display:flex;align-items:center;justify-content:center;color:#000;font-size:11px;font-weight:700">●</div>`,
  });
}
