import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, RefreshCw, Wind, Thermometer, Droplets, AlertTriangle, X, Plus } from "lucide-react";
import { DispatchPanel } from "@/components/DispatchPanel";
import { supabase } from "@/integrations/supabase/client";
import { getFirmsHotspots } from "@/lib/firms.functions";
import { getRedFlagAlerts } from "@/lib/nws.functions";
import { getWindAtPoint } from "@/lib/synoptic.functions";
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
  head: () => ({ meta: [{ title: "Incidents — Aegis Command" }] }),
  component: IncidentsPage,
  ssr: false,
});

function IncidentsPage() {
  const qc = useQueryClient();
  const firmsFn = useServerFn(getFirmsHotspots);
  const nwsFn = useServerFn(getRedFlagAlerts);
  const windFn = useServerFn(getWindAtPoint);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");

  // Realtime subscription for incidents
  useEffect(() => {
    const ch = supabase
      .channel("incidents-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        qc.invalidateQueries({ queryKey: ["incidents"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_events" }, () => {
        qc.invalidateQueries({ queryKey: ["incident_events"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents"],
    queryFn: fetchIncidents,
    refetchInterval: 30_000,
  });

  const { data: firms } = useQuery({
    queryKey: ["firms"],
    queryFn: () => firmsFn(),
    refetchInterval: 15 * 60_000,
    staleTime: 10 * 60_000,
  });

  const { data: nws } = useQuery({
    queryKey: ["nws-redflag"],
    queryFn: () => nwsFn(),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const hotspots = firms?.hotspots ?? [];
  const redFlagCount = nws?.alerts?.length ?? 0;

  const visible = useMemo(() => {
    if (statusFilter === "all") return incidents;
    return incidents.filter((i) => !["closed", "false_positive"].includes(i.status));
  }, [incidents, statusFilter]);

  const selected = useMemo(
    () => incidents.find((i) => i.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  const promote = async (lat: number, lng: number, frp: number, conf: string) => {
    try {
      const row = await createIncidentFromHotspot({ lat, lng, frp, confidence: conf, source: "firms" });
      setSelectedId(row.id);
      toast.success("Incident opened");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create");
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left CAD queue */}
      <aside className="w-[320px] shrink-0 flex flex-col border-r border-white/10 bg-black/30 backdrop-blur">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">CAD Queue</div>
            <div className="text-sm font-semibold">{visible.length} active</div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter("active")}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${statusFilter === "active" ? "bg-primary/20 text-primary border border-primary/40" : "border border-white/10 text-muted-foreground"}`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${statusFilter === "all" ? "bg-primary/20 text-primary border border-primary/40" : "border border-white/10 text-muted-foreground"}`}
            >
              All
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No incidents. Tap a FIRMS hotspot on the map to open one.
            </div>
          )}
          {visible.map((i) => {
            const sm = STATUS_META[i.status];
            const pm = PRIORITY_META[i.priority];
            const active = i.id === selectedId;
            return (
              <button
                key={i.id}
                onClick={() => setSelectedId(i.id)}
                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/[0.04] transition ${active ? "bg-primary/10" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: `${pm.color}22`, color: pm.color, border: `1px solid ${pm.color}66` }}
                  >
                    {pm.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: sm.color }}>
                    {sm.label}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {timeAgo(i.discovered_at)}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium truncate">{i.title}</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {i.lat.toFixed(3)}, {i.lng.toFixed(3)}
                  {i.frp != null && <> · FRP {Number(i.frp).toFixed(1)}</>}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Center map */}
      <div className="flex-1 relative min-w-0">
        <MapContainer
          center={[37.5, -119]}
          zoom={6}
          className="absolute inset-0"
          preferCanvas
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {/* FIRMS hotspots */}
          {hotspots.map((h, idx) => (
            <CircleMarker
              key={`h${idx}`}
              center={[h.lat, h.lng]}
              radius={Math.min(10, 3 + (h.frp || 0) / 10)}
              pathOptions={{
                color: h.confidence === "h" ? "#ef4444" : h.confidence === "n" ? "#f97316" : "#fbbf24",
                fillColor: h.confidence === "h" ? "#ef4444" : h.confidence === "n" ? "#f97316" : "#fbbf24",
                fillOpacity: 0.55,
                weight: 1,
              }}
              eventHandlers={{ click: () => undefined }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" /> FIRMS hotspot</div>
                  <div className="font-mono">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</div>
                  <div>FRP: {h.frp.toFixed(1)} MW · Conf: {h.confidence || "?"}</div>
                  <div className="text-muted-foreground">{new Date(h.acq_datetime).toLocaleString()}</div>
                  <button
                    onClick={() => promote(h.lat, h.lng, h.frp, h.confidence)}
                    className="mt-1 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:brightness-110"
                  >
                    <Plus className="h-3 w-3" /> Open incident
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {/* Incident markers */}
          {incidents.map((i) => (
            <Marker
              key={i.id}
              position={[i.lat, i.lng]}
              icon={incidentIcon(STATUS_META[i.status].color, PRIORITY_META[i.priority].color)}
              eventHandlers={{ click: () => setSelectedId(i.id) }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{i.title}</div>
                  <div>{STATUS_META[i.status].label} · {PRIORITY_META[i.priority].label}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Map overlay status */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-[400]">
          <div className="aw-popup rounded-md px-3 py-2 text-[11px] space-y-1 min-w-[220px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">FIRMS (24h)</span>
              <span className="font-mono">{hotspots.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Red Flag</span>
              <span className="font-mono flex items-center gap-1">
                {redFlagCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                {redFlagCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right detail panel */}
      {selected && (
        <IncidentDetail
          key={selected.id}
          incident={selected}
          onClose={() => setSelectedId(null)}
          onStatusChange={async (s) => {
            try {
              await updateIncidentStatus(selected.id, s);
              toast.success(`Status → ${STATUS_META[s].label}`);
            } catch (e: any) {
              toast.error(e?.message ?? "Failed");
            }
          }}
          windFn={windFn}
        />
      )}
    </div>
  );
}

function IncidentDetail({
  incident,
  onClose,
  onStatusChange,
  windFn,
}: {
  incident: IncidentRow;
  onClose: () => void;
  onStatusChange: (s: IncidentStatus) => void;
  windFn: (args: { data: { lat: number; lng: number } }) => Promise<{ obs: any; error?: string }>;
}) {

  const { data: events = [] } = useQuery({
    queryKey: ["incident_events", incident.id],
    queryFn: () => fetchIncidentEvents(incident.id),
  });

  const { data: wind, isFetching: windLoading, refetch: refetchWind } = useQuery({
    queryKey: ["wind", incident.id],
    queryFn: () => windFn({ data: { lat: incident.lat, lng: incident.lng } }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const sm = STATUS_META[incident.status];
  const pm = PRIORITY_META[incident.priority];
  const obs = wind?.obs;

  return (
    <aside className="w-[360px] shrink-0 flex flex-col border-l border-white/10 bg-black/30 backdrop-blur overflow-y-auto">
      <div className="p-3 border-b border-white/10 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: `${pm.color}22`, color: pm.color, border: `1px solid ${pm.color}66` }}
            >
              {pm.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: sm.color }}>
              {sm.label}
            </span>
          </div>
          <div className="mt-1 text-sm font-semibold truncate">{incident.title}</div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status workflow */}
      <div className="p-3 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Workflow</div>
        <div className="grid grid-cols-2 gap-1.5">
          {(["triaging", "dispatched", "onscene", "contained", "closed", "false_positive"] as IncidentStatus[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                disabled={s === incident.status}
                className="rounded border border-white/10 px-2 py-1.5 text-[11px] hover:bg-white/5 disabled:opacity-40"
                style={s === incident.status ? { borderColor: STATUS_META[s].color, color: STATUS_META[s].color } : undefined}
              >
                {STATUS_META[s].label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Synoptic wind */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">On-Scene Weather</div>
          <button onClick={() => refetchWind()} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-3 w-3 ${windLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {!obs ? (
          <div className="text-xs text-muted-foreground">
            {wind?.error ? `No data: ${wind.error}` : "Loading station…"}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground">
              {obs.name} ({obs.station}) · {obs.distance_mi.toFixed(1)} mi
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Wind className="h-3 w-3" />} label="Wind" value={obs.wind_speed_mph != null ? `${obs.wind_speed_mph.toFixed(0)} mph` : "—"} sub={obs.wind_dir_deg != null ? `${Math.round(obs.wind_dir_deg)}°` : ""} />
              <Stat icon={<Wind className="h-3 w-3" />} label="Gust" value={obs.wind_gust_mph != null ? `${obs.wind_gust_mph.toFixed(0)} mph` : "—"} />
              <Stat icon={<Thermometer className="h-3 w-3" />} label="Temp" value={obs.temp_f != null ? `${obs.temp_f.toFixed(0)}°F` : "—"} />
              <Stat icon={<Droplets className="h-3 w-3" />} label="RH" value={obs.rh_pct != null ? `${obs.rh_pct.toFixed(0)}%` : "—"} />
            </div>
            {obs.observed_at && (
              <div className="text-[10px] text-muted-foreground">Obs: {new Date(obs.observed_at).toLocaleTimeString()}</div>
            )}
          </div>
        )}
      </div>

      {/* Assign drone placeholder (Phase 3) */}
      <div className="p-3 border-b border-white/10">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Dispatch</div>
        <button
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary/30 px-3 py-2 text-sm font-medium text-primary-foreground/70 cursor-not-allowed"
          title="Phase 3"
        >
          <Send className="h-3.5 w-3.5" /> Assign drone (Phase 3)
        </button>
      </div>

      {/* Timeline */}
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
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
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
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${statusColor};box-shadow:0 0 0 2px ${priorityColor},0 0 12px ${statusColor}aa;display:flex;align-items:center;justify-content:center;color:#000;font-size:11px;font-weight:700">●</div>`,
  });
}
