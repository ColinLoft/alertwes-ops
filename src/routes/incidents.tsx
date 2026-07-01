import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, RefreshCw, Wind, Thermometer, Droplets, AlertTriangle, X, Plus, Sparkles, Check, Eye, VolumeX, Activity, ThumbsDown, ShieldCheck } from "lucide-react";
import { DispatchPanel } from "@/components/DispatchPanel";
import { CameraMarkersLayer } from "@/components/CameraMarkersLayer";
import { CameraPanel } from "@/components/CameraPanel";
import { PlanesLayer } from "@/components/PlanesLayer";
import { supabase } from "@/integrations/supabase/client";
import { getFirmsHotspots } from "@/lib/firms.functions";
import { getRedFlagAlerts } from "@/lib/nws.functions";
import { getWindAtPoint } from "@/lib/synoptic.functions";
import { sweepCameras } from "@/lib/ai-detect.functions";
import { fetchCameras, type Camera } from "@/lib/alertwest";
import { useCameraHistory } from "@/hooks/useCameraHistory";
import { fetchDetectionArea, getDetectionAreaCenter, getDetectionAreaBounds, isInDetectionArea, isRegionTextInDetectionArea } from "@/lib/area";
import { fetchPendingSuggestions, dismissSuggestion, promoteSuggestion, muteCamera, fetchSweepStatus, fetchCameraHealth, markFalsePositive, type SuggestionRow, type CameraHealth } from "@/lib/suggestions";
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
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number; key: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [sweeping, setSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState<{ done: number; total: number } | null>(null);
  const [sweepResults, setSweepResults] = useState<null | { results: any[]; analyzed: number; created: number }>(null);
  const [sweepPanelOpen, setSweepPanelOpen] = useState(false);


  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("cad-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => qc.invalidateQueries({ queryKey: ["incidents"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_events" }, () => qc.invalidateQueries({ queryKey: ["incident_events"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_suggestions" }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["suggestions"] });
        const s = payload?.new;
        if (s && (s.label === "fire" || s.label === "smoke")) {
          const isFire = s.label === "fire";
          toast[isFire ? "error" : "warning"](
            `${isFire ? "🔥 Fire" : "💨 Smoke"} detected — ${s.camera_name ?? "camera"} (${s.confidence}%)`,
            { description: s.reasoning ?? undefined, duration: 12_000 },
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 30_000 });
  const { data: firms } = useQuery({ queryKey: ["firms"], queryFn: () => firmsFn(), refetchInterval: 15 * 60_000, staleTime: 10 * 60_000 });
  const { data: nws } = useQuery({ queryKey: ["nws-redflag"], queryFn: () => nwsFn(), refetchInterval: 5 * 60_000, staleTime: 60_000 });
  const { data: area } = useQuery({ queryKey: ["detection_area"], queryFn: fetchDetectionArea });
  const { data: suggestions = [] } = useQuery({ queryKey: ["suggestions"], queryFn: fetchPendingSuggestions, refetchInterval: 30_000 });
  const { data: cameras = [], dataUpdatedAt: camerasUpdatedAt } = useQuery({ queryKey: ["aw-cameras"], queryFn: fetchCameras, staleTime: 5 * 60_000, refetchInterval: 60_000 });
  const cameraHistory = useCameraHistory(cameras, camerasUpdatedAt);
  const { data: sweepStatus } = useQuery({ queryKey: ["sweep_status"], queryFn: fetchSweepStatus, refetchInterval: 15_000 });
  const { data: cameraHealth = {} } = useQuery({ queryKey: ["camera_health"], queryFn: fetchCameraHealth, refetchInterval: 60_000 });

  // Cameras restricted to the detection area for map overlay.
  const inAreaCameras = useMemo(() => {
    if (!area) return [];
    return cameras.filter((c) => {
      const lat = Number(c.site.latitude), lng = Number(c.site.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return false;
      return isInDetectionArea({ lat, lng, state: c.site.state, county: c.site.county }, area);
    });
  }, [cameras, area]);

  const hotspots = useMemo(() => {
    const all = firms?.hotspots ?? [];
    if (!area) return [];
    return all.filter((h) => isInDetectionArea({ lat: h.lat, lng: h.lng }, area));
  }, [firms, area]);

  const filteredAlerts = useMemo(() => {
    const all = nws?.alerts ?? [];
    if (!area) return [];
    return all.filter((a: any) => {
      if (a.lat != null && a.lng != null && isInDetectionArea({ lat: a.lat, lng: a.lng }, area)) return true;
      if (isRegionTextInDetectionArea(a.areaDesc, area)) return true;
      return false;
    });
  }, [nws, area]);
  const redFlagCount = filteredAlerts.length;

  const mapCenter = useMemo(() => getDetectionAreaCenter(area), [area]);

  // Union of detection-area bounding boxes for plane fetching (independent of zoom).
  const planesBbox = useMemo(() => {
    const bs = getDetectionAreaBounds(area);
    if (!bs.length) return null;
    return bs.reduce(
      (acc, b) => ({
        lamin: Math.min(acc.lamin, b.lamin),
        lomin: Math.min(acc.lomin, b.lomin),
        lamax: Math.max(acc.lamax, b.lamax),
        lomax: Math.max(acc.lomax, b.lomax),
      }),
      { lamin: bs[0].lamin, lomin: bs[0].lomin, lamax: bs[0].lamax, lomax: bs[0].lomax },
    );
  }, [area]);

  const visible = useMemo(() => {
    if (statusFilter === "all") return incidents;
    return incidents.filter((i) => !["closed", "false_positive"].includes(i.status));
  }, [incidents, statusFilter]);

  const selected = useMemo(() => incidents.find((i) => i.id === selectedId) ?? null, [incidents, selectedId]);
  const selectedCamera = useMemo(
    () => (selectedCameraId ? inAreaCameras.find((c) => c.site.id === selectedCameraId) ?? cameras.find((c) => c.site.id === selectedCameraId) ?? null : null),
    [selectedCameraId, inAreaCameras, cameras],
  );

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
    if (candidates.length === 0) return toast.error("No in-area cameras with recent frames");
    setSweeping(true);
    setSweepResults(null);
    setSweepPanelOpen(true);
    setSweepProgress({ done: 0, total: candidates.length });
    toast.message(`AI sweeping ${candidates.length} cameras…`);
    try {
      const CHUNK = 25;
      const allResults: any[] = [];
      let analyzed = 0, created = 0;
      for (let i = 0; i < candidates.length; i += CHUNK) {
        const slice = candidates.slice(i, i + CHUNK);
        const res = await sweepFn({
          data: {
            cameras: slice.map((c) => ({
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
        allResults.push(...(res.results ?? []));
        analyzed += res.analyzed;
        created += res.created;
        setSweepProgress({ done: Math.min(i + CHUNK, candidates.length), total: candidates.length });
        // Live update so results stream in as chunks complete
        setSweepResults({
          results: [...allResults].sort((a, b) => {
            const rank = (l: string) => (l === "fire" ? 0 : l === "smoke" ? 1 : 2);
            return rank(a.label) - rank(b.label) || (b.confidence ?? 0) - (a.confidence ?? 0);
          }),
          analyzed,
          created,
        });
      }
      toast.success(`Sweep complete — analyzed ${analyzed}, ${created} flagged for review`);
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Sweep failed");
    } finally { setSweeping(false); setSweepProgress(null); }
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

  const focusCamera = (camId: string | null, lat?: number | null, lng?: number | null) => {
    if (camId) setSelectedCameraId(camId);
    setSelectedId(null);
    const cam = camId ? cameras.find((c) => c.site.id === camId) : null;
    const targetLat = cam ? Number(cam.site.latitude) : lat != null ? Number(lat) : NaN;
    const targetLng = cam ? Number(cam.site.longitude) : lng != null ? Number(lng) : NaN;
    if (Number.isFinite(targetLat) && Number.isFinite(targetLng)) {
      setFlyTarget({ lat: targetLat, lng: targetLng, zoom: 12, key: Date.now() });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-44px)] overflow-hidden">
      {/* Sweep status panel */}
      <SweepStatusPanel status={sweepStatus} inAreaCameras={inAreaCameras.length} pendingShown={suggestions.length} />

      {/* Triage strip */}
      <TriageStrip
        suggestions={suggestions}
        cameraHealth={cameraHealth}
        onConfirm={onPromoteSug}
        onFocusCamera={(s) => focusCamera(s.camera_id ?? null, s.lat, s.lng)}
        onFalsePositive={async (s) => {
          try { await markFalsePositive(s.id); toast.success("Marked false positive — will improve future sweeps"); qc.invalidateQueries({ queryKey: ["suggestions"] }); qc.invalidateQueries({ queryKey: ["camera_health"] }); }
          catch (e: any) { toast.error(e?.message ?? "Failed"); }
        }}
        onDismiss={async (id) => { await dismissSuggestion(id); qc.invalidateQueries({ queryKey: ["suggestions"] }); }}
        onMute={async (s) => {
          try { await muteCamera(s.camera_id ?? "", s.camera_name, 24, "False positive (dirty/glare)"); toast.success("Camera muted for 24h"); qc.invalidateQueries({ queryKey: ["suggestions"] }); }
          catch (e: any) { toast.error(e?.message ?? "Failed"); }
        }}
        onSweep={runSweep} sweeping={sweeping}
      />


      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-white/10 glass-subtle flex items-center gap-3 text-[11px]">
        <span className="uppercase tracking-[0.18em] text-muted-foreground">Active Calls</span>
        <span className="font-mono">{visible.length}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground">Cameras (area): <span className="font-mono text-foreground">{inAreaCameras.length}</span></span>
          <span className="text-muted-foreground">FIRMS 24h (area): <span className="font-mono text-foreground">{hotspots.length}</span></span>
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
          <MapContainer key={area ? `${area.mode}-${mapCenter.lat}-${mapCenter.lng}-${area.counties.join("|")}` : "loading"} center={[mapCenter.lat, mapCenter.lng]} zoom={6} className="absolute inset-0" preferCanvas>
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
            <CameraMarkersLayer
              cameras={inAreaCameras}
              selectedId={selectedCameraId}
              onSelect={(id) => { setSelectedCameraId(id); setSelectedId(null); }}
              showPulse={false}
            />
            <PlanesLayer refreshSeconds={30} radius={null} bounds={null} fixedBbox={planesBbox} />
            <MapFlyController target={flyTarget} />
          </MapContainer>
          {selectedCamera && (
            <CameraPanel
              camera={selectedCamera}
              onClose={() => setSelectedCameraId(null)}
              history={cameraHistory[selectedCamera.site.id] ?? []}
            />
          )}
        </div>


        {selected && (
          <IncidentDetail key={selected.id} incident={selected} onClose={() => setSelectedId(null)}
            onStatusChange={async (s) => {
              try { await updateIncidentStatus(selected.id, s); toast.success(`Status → ${STATUS_META[s].label}`); }
              catch (e: any) { toast.error(e?.message ?? "Failed"); }
            }} windFn={windFn} />
        )}
      </div>

      {(sweeping || (sweepResults && sweepPanelOpen)) && (
        <SweepFloatingPanel
          sweeping={sweeping}
          progress={sweepProgress}
          data={sweepResults}
          open={sweepPanelOpen}
          onToggle={() => setSweepPanelOpen((o) => !o)}
          onClose={() => { setSweepResults(null); setSweepPanelOpen(false); }}
          onFocus={(camId, lat, lng) => focusCamera(camId, lat, lng)}
        />
      )}
    </div>
  );
}

/** Non-blocking floating sweep progress + results panel pinned to bottom-right. */
function SweepFloatingPanel({ sweeping, progress, data, open, onToggle, onClose, onFocus }: {
  sweeping: boolean;
  progress: { done: number; total: number } | null;
  data: { results: any[]; analyzed: number; created: number } | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onFocus: (camId: string | null, lat?: number | null, lng?: number | null) => void;
}) {
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : (data ? 100 : 0);
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[900] w-[380px] max-w-[95vw]">
      <div className="pointer-events-auto rounded-xl border border-white/10 bg-[oklch(0.13_0.01_250)/0.96] shadow-2xl backdrop-blur-xl overflow-hidden">
        <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/10 hover:bg-white/5">
          <Sparkles className={`h-4 w-4 text-primary ${sweeping ? "animate-pulse" : ""}`} />
          <span className="text-[12px] font-semibold">AI Sweep</span>
          <span className="text-[11px] text-muted-foreground">
            {sweeping
              ? `${progress?.done ?? 0}/${progress?.total ?? 0}`
              : data ? `${data.analyzed} scanned · ${data.created} flagged` : ""}
          </span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">{open ? "Hide" : "Show"}</span>
          {!sweeping && (
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </button>
        <div className="px-3 py-1.5 border-b border-white/10">
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{pct}% · keep working — this won't block you</div>
        </div>
        {open && (
          <div className="max-h-[40vh] overflow-auto p-2 space-y-1.5">
            {(data?.results ?? []).length === 0 && !sweeping && (
              <div className="text-xs text-muted-foreground text-center py-6">No results yet.</div>
            )}
            {(data?.results ?? []).map((r, i) => {
              const tone = r.label === "fire" ? "bg-rose-500/15 border-rose-500/40 text-rose-200"
                : r.label === "smoke" ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                : "bg-white/[0.03] border-white/10 text-foreground/80";
              return (
                <button
                  key={i}
                  onClick={() => onFocus(r.camera_id ?? null, r.lat, r.lng)}
                  className={`w-full rounded border px-2.5 py-2 text-[11px] flex items-center gap-2 ${tone} hover:brightness-110`}
                  title="Show on map"
                >
                  {r.image_url && <img src={r.image_url} alt="" className="h-9 w-12 object-cover rounded shrink-0" />}
                  <span className="uppercase tracking-wider text-[10px] font-bold w-11 text-left">{r.label}</span>
                  <span className="font-mono text-[11px] w-10 text-right">{r.confidence}%</span>
                  <span className="flex-1 truncate text-left" title={r.camera_name}>{r.camera_name}</span>
                  {r.queued && <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">Queued</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MapFlyController({ target }: { target: { lat: number; lng: number; zoom: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.9 });
  }, [target?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}


function FilterPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${on ? "bg-primary/20 text-primary border border-primary/40" : "border border-white/10 text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function SweepStatusPanel({ status, inAreaCameras, pendingShown }: {
  status: { last_run_at: string | null; last_window_count: number; pending_in_area: number; total_24h: number } | undefined;
  inAreaCameras: number;
  pendingShown: number;
}) {
  const ageS = status?.last_run_at ? Math.max(0, (Date.now() - new Date(status.last_run_at).getTime()) / 1000) : null;
  const fresh = ageS != null && ageS < 90;
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/10 glass-subtle text-[11px]">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${fresh ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
        <Activity className={`h-3 w-3 ${fresh ? "animate-pulse" : ""}`} />
        <span className="font-semibold uppercase tracking-wider text-[10px]">Sweep</span>
      </span>
      <span className="text-muted-foreground">Last: <span className="font-mono text-foreground">{ageS == null ? "—" : ageS < 60 ? `${Math.floor(ageS)}s ago` : `${Math.floor(ageS / 60)}m ago`}</span></span>
      <span className="text-muted-foreground">Last 2m: <span className="font-mono text-foreground">{status?.last_window_count ?? 0}</span> queued</span>
      <span className="text-muted-foreground">Pending: <span className="font-mono text-foreground">{pendingShown}</span></span>
      <span className="text-muted-foreground">24h: <span className="font-mono text-foreground">{status?.total_24h ?? 0}</span></span>
      <span className="ml-auto text-muted-foreground">Area cameras: <span className="font-mono text-foreground">{inAreaCameras}</span></span>
    </div>
  );
}

function TriageStrip({ suggestions, cameraHealth, onConfirm, onFalsePositive, onDismiss, onMute, onFocusCamera, onSweep, sweeping }: {
  suggestions: SuggestionRow[];
  cameraHealth: Record<string, CameraHealth>;
  onConfirm: (s: SuggestionRow) => void;
  onFalsePositive: (s: SuggestionRow) => void;
  onDismiss: (id: string) => void;
  onMute: (s: SuggestionRow) => void;
  onFocusCamera: (s: SuggestionRow) => void;
  onSweep: () => void;
  sweeping: boolean;
}) {
  return (
    <div className="border-b border-white/10 glass-subtle">
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AI Triage</div>
        <span className="text-[11px] text-muted-foreground">{suggestions.length} pending</span>
        <span className="text-[10px] text-muted-foreground hidden md:inline">· auto-sweeping every minute · feedback trains future runs</span>
        <button onClick={onSweep} disabled={sweeping}
          className="ml-auto inline-flex items-center gap-1.5 rounded bg-primary/15 border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/25 disabled:opacity-50">
          <Eye className={`h-3 w-3 ${sweeping ? "animate-pulse" : ""}`} /> {sweeping ? "Analyzing…" : "Sweep now"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {suggestions.map((s) => {
            const health = s.camera_id ? cameraHealth[s.camera_id] : undefined;
            const healthColor = !health ? "text-muted-foreground" : health.score >= 75 ? "text-emerald-300" : health.score >= 50 ? "text-amber-300" : "text-rose-300";
            return (
              <div key={s.id} className="shrink-0 w-[280px] rounded-lg border border-white/10 bg-white/[0.04] overflow-hidden">
                {s.image_url && (
                  <button onClick={() => onFocusCamera(s)} title="Show camera on map" className="block w-full">
                    <img src={s.image_url} alt="" className="w-full h-[100px] object-cover transition hover:brightness-110" />
                  </button>
                )}
                <div className="p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.label === "fire" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{s.confidence}%</span>
                    <button onClick={() => onFocusCamera(s)} title="Show on map" className="ml-auto text-[10px] text-muted-foreground truncate max-w-[110px] hover:text-primary hover:underline text-right">{s.camera_name}</button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <ShieldCheck className={`h-3 w-3 ${healthColor}`} />
                    <span className={`font-mono ${healthColor}`} title={health ? `${health.confirmed} confirmed / ${health.false_positives} FP last 30d` : "No history"}>
                      Health {health ? `${health.score}%` : "—"}
                    </span>
                    {health?.flagged && (
                      <span className="rounded bg-rose-500/15 px-1 py-0.5 text-[9px] uppercase tracking-wider text-rose-300 border border-rose-500/30">
                        Repeat FP
                      </span>
                    )}
                  </div>
                  {s.reasoning && <div className="text-[10.5px] text-muted-foreground line-clamp-2">{s.reasoning}</div>}
                  <div className="flex gap-1 pt-0.5">
                    <button onClick={() => onConfirm(s)} title="Confirm — open incident" className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30">
                      <Check className="h-3 w-3" /> Confirmed
                    </button>
                    <button onClick={() => onFalsePositive(s)} title="False positive — train future sweeps" className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-rose-500/15 border border-rose-500/40 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/25">
                      <ThumbsDown className="h-3 w-3" /> False
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onDismiss(s.id)} title="Dismiss without verdict" className="flex-1 inline-flex items-center justify-center rounded border border-white/10 px-2 py-1 text-[10px] hover:bg-white/5">
                      <X className="h-3 w-3" /> Skip
                    </button>
                    <button onClick={() => onMute(s)} title="Mute camera 24h (dirty / glare / fog)"
                      className="inline-flex items-center justify-center rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-500/20">
                      <VolumeX className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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

      <NotesPanel incidentId={incident.id} />

      <div className="p-3 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Timeline</div>
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground">No events yet.</div>
        ) : (
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="text-[11px] border-l border-white/10 pl-2">
                <div className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</div>
                <div className="text-foreground whitespace-pre-wrap">{e.message ?? e.event_type}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function NotesPanel({ incidentId }: { incidentId: string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const text = note.trim();
    if (!text) return;
    setSaving(true);
    const { error } = await supabase.from("incident_events").insert({
      incident_id: incidentId, event_type: "note", message: text,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNote("");
    qc.invalidateQueries({ queryKey: ["incident_events", incidentId] });
    toast.success("Note added");
  };
  return (
    <div className="p-3 border-b border-white/10">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Notes</div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        placeholder="Add a note — observation, ops update, mission detail…"
        className="w-full rounded-md border border-white/10 bg-background px-2 py-1.5 text-xs resize-y" />
      <div className="mt-1 flex justify-end">
        <button onClick={submit} disabled={saving || !note.trim()}
          className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
          {saving ? "Saving…" : "Add note"}
        </button>
      </div>
    </div>
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
