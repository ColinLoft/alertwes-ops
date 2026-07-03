import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Rectangle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getFirmsHotspots } from "@/lib/firms.functions";
import { getRedFlagAlerts } from "@/lib/nws.functions";
import { sweepCameras } from "@/lib/ai-detect.functions";
import { fetchCameras, type Camera } from "@/lib/alertwest";
import { fetchDetectionArea, getDetectionAreaCenter, getDetectionAreaBounds, isInDetectionArea, isRegionTextInDetectionArea } from "@/lib/area";
import { fetchIncidents, PRIORITY_META, STATUS_META } from "@/lib/incidents";
import { fetchDrones } from "@/lib/drones";
import { fetchBases } from "@/lib/drones";
import { fetchPendingSuggestions } from "@/lib/suggestions";

import { CameraMarkersLayer } from "@/components/CameraMarkersLayer";
import { PlanesLayer } from "@/components/PlanesLayer";
import { LeftRail } from "@/components/mission/LeftRail";
import { MissionDrawer, TriagePanel } from "@/components/mission/Drawer";
import { LayerManager } from "@/components/mission/LayerManager";
import { LiveFeed } from "@/components/mission/LiveFeed";
import { Inspector } from "@/components/mission/Inspector";
import { useMission, useLayers } from "@/lib/mission-store";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Mission Control — Aegis" }] }),
  component: MapPage,
  ssr: false,
});

function MapPage() {
  const qc = useQueryClient();
  const firmsFn = useServerFn(getFirmsHotspots);
  const nwsFn = useServerFn(getRedFlagAlerts);
  const sweepFn = useServerFn(sweepCameras);

  const select = useMission((s) => s.select);
  const flyTarget = useMission((s) => s.flyTarget);
  const flyTo = useMission((s) => s.flyTo);
  const layers = useLayers((s) => s.layers);

  const { data: area } = useQuery({ queryKey: ["detection_area"], queryFn: fetchDetectionArea });
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 30_000 });
  const { data: firms } = useQuery({ queryKey: ["firms"], queryFn: () => firmsFn(), refetchInterval: 15 * 60_000, staleTime: 10 * 60_000 });
  const { data: nws } = useQuery({ queryKey: ["nws-redflag"], queryFn: () => nwsFn(), refetchInterval: 5 * 60_000, staleTime: 60_000 });
  const { data: cameras = [] } = useQuery({ queryKey: ["aw-cameras"], queryFn: fetchCameras, staleTime: 5 * 60_000, refetchInterval: 60_000 });
  const { data: drones = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones, refetchInterval: 60_000 });
  const { data: bases = [] } = useQuery({ queryKey: ["bases"], queryFn: fetchBases });
  const { data: suggestions = [] } = useQuery({ queryKey: ["suggestions"], queryFn: fetchPendingSuggestions, refetchInterval: 30_000 });

  // Realtime notifications
  useEffect(() => {
    const ch = supabase
      .channel("mission-stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => qc.invalidateQueries({ queryKey: ["incidents"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_events" }, () => qc.invalidateQueries({ queryKey: ["incident_events"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_suggestions" }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["suggestions"] });
        const s = payload?.new;
        if (s && (s.label === "fire" || s.label === "smoke")) {
          const fire = s.label === "fire";
          toast[fire ? "error" : "warning"](
            `${fire ? "🔥 Fire" : "💨 Smoke"} — ${s.camera_name ?? "camera"} (${s.confidence}%)`,
            { description: s.reasoning ?? undefined, duration: 12_000 },
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

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

  const redFlagAlerts = useMemo(() => {
    const all = nws?.alerts ?? [];
    if (!area) return [];
    return all.filter((a: any) => {
      if (a.lat != null && a.lng != null && isInDetectionArea({ lat: a.lat, lng: a.lng }, area)) return true;
      if (isRegionTextInDetectionArea(a.areaDesc, area)) return true;
      return false;
    });
  }, [nws, area]);

  const activeIncidents = useMemo(
    () => incidents.filter((i) => !["closed", "false_positive"].includes(i.status)),
    [incidents],
  );

  const areaBounds = useMemo(() => getDetectionAreaBounds(area), [area]);

  const planesBbox = useMemo(() => {
    if (!areaBounds.length) return null;
    return areaBounds.reduce(
      (acc, b) => ({
        lamin: Math.min(acc.lamin, b.lamin),
        lomin: Math.min(acc.lomin, b.lomin),
        lamax: Math.max(acc.lamax, b.lamax),
        lomax: Math.max(acc.lomax, b.lomax),
      }),
      { lamin: areaBounds[0].lamin, lomin: areaBounds[0].lomin, lamax: areaBounds[0].lamax, lomax: areaBounds[0].lomax },
    );
  }, [areaBounds]);

  const center = useMemo(() => getDetectionAreaCenter(area), [area]);

  const runSweep = async () => {
    if (!area) return toast.error("Detection area not loaded");
    const candidates: Camera[] = inAreaCameras.filter((c) => {
      if (!c.image.url || !c.image.time) return false;
      const ageMin = (Date.now() - new Date(c.image.time).getTime()) / 60000;
      return ageMin <= 120;
    });
    if (candidates.length === 0) return toast.error("No in-area cameras with recent frames");
    const toastId = toast.loading(`AI sweeping ${candidates.length} cameras…`);
    try {
      const CHUNK = 25;
      let analyzed = 0, created = 0;
      for (let i = 0; i < candidates.length; i += CHUNK) {
        const slice = candidates.slice(i, i + CHUNK);
        const res = await sweepFn({ data: { cameras: slice.map((c) => ({
          camera_id: c.site.id, camera_name: c.name,
          image_url: c.image.url!, image_time: c.image.time!,
          lat: Number(c.site.latitude), lng: Number(c.site.longitude),
          state: c.site.state, county: c.site.county,
        })) } });
        analyzed += res.analyzed; created += res.created;
        toast.loading(`AI sweep · ${Math.min(i + CHUNK, candidates.length)}/${candidates.length} · ${created} flagged`, { id: toastId });
      }
      toast.success(`Sweep complete — ${analyzed} scanned · ${created} flagged`, { id: toastId });
      qc.invalidateQueries({ queryKey: ["suggestions"] });
    } catch (e: any) { toast.error(e?.message ?? "Sweep failed", { id: toastId }); }
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background text-foreground">
      <LeftRail counts={{ incidents: activeIncidents.length, cameras: inAreaCameras.length, units: drones.length }} />

      <div className="relative flex-1">
        <MapContainer
          key={area ? `${area.mode}-${center.lat}-${center.lng}-${area.counties.join("|")}` : "loading"}
          center={[center.lat, center.lng]}
          zoom={7}
          className="absolute inset-0"
          preferCanvas
          attributionControl={false}
          zoomControl={false}
        >
          <TileLayer attribution="" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

          {/* Detection area outline */}
          {layers.detectionArea && areaBounds.map((b, idx) => (
            <Rectangle key={idx} bounds={[[b.lamin, b.lomin], [b.lamax, b.lomax]]}
              pathOptions={{ color: "#64748b", weight: 1, fillOpacity: 0.04, dashArray: "4 4" }} />
          ))}

          {/* FIRMS */}
          {layers.firms && hotspots.map((h, idx) => (
            <CircleMarker key={`h${idx}`} center={[h.lat, h.lng]} radius={Math.min(10, 3 + (h.frp || 0) / 10)}
              pathOptions={{
                color: h.confidence === "h" ? "#ef4444" : h.confidence === "n" ? "#f97316" : "#fbbf24",
                fillColor: h.confidence === "h" ? "#ef4444" : h.confidence === "n" ? "#f97316" : "#fbbf24",
                fillOpacity: 0.55, weight: 1,
              }}
              eventHandlers={{ click: () => select({ kind: "hotspot", id: `${h.lat},${h.lng}`, payload: h }) }}
            />
          ))}

          {/* Incidents */}
          {layers.incidents && incidents.map((i) => (
            <Marker key={i.id} position={[i.lat, i.lng]}
              icon={incidentIcon(STATUS_META[i.status].color, PRIORITY_META[i.priority].color)}
              eventHandlers={{ click: () => select({ kind: "incident", id: i.id }) }}
            />
          ))}

          {/* Cameras */}
          {layers.cameras && (
            <CameraMarkersLayer
              cameras={inAreaCameras}
              selectedId={useMission.getState().selection.kind === "camera" ? useMission.getState().selection.id : null}
              onSelect={(id) => {
                const c = inAreaCameras.find((c) => c.site.id === id);
                select({ kind: "camera", id, payload: c });
              }}
              showPulse={false}
            />
          )}

          {/* Bases */}
          {layers.bases && bases.map((b) => (
            <CircleMarker key={b.id} center={[b.lat, b.lng]} radius={7}
              pathOptions={{ color: "#a78bfa", fillColor: "#a78bfa", fillOpacity: 0.6, weight: 2 }}>
              <Popup><div className="text-xs"><div className="font-semibold">{b.code} · {b.name}</div><div>{b.city}, {b.state}</div></div></Popup>
            </CircleMarker>
          ))}

          {/* Aircraft (ADS-B) */}
          {layers.aircraft && (
            <PlanesLayer refreshSeconds={30} radius={null} bounds={null} fixedBbox={planesBbox} />
          )}

          {/* Red flag centroids */}
          {layers.redflag && redFlagAlerts.map((a: any, idx: number) => (
            a.lat != null && a.lng != null ? (
              <CircleMarker key={`rf${idx}`} center={[a.lat, a.lng]} radius={6}
                pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.35, weight: 1 }}>
                <Popup><div className="text-xs"><div className="font-semibold text-amber-500">Red Flag</div>{a.areaDesc}</div></Popup>
              </CircleMarker>
            ) : null
          ))}

          <FlyController target={flyTarget} />
        </MapContainer>

        {/* Overlays */}
        <TopStatus
          sweeping={false}
          onSweep={runSweep}
          counts={{ hotspots: hotspots.length, cameras: inAreaCameras.length, incidents: activeIncidents.length, redflag: redFlagAlerts.length, pending: suggestions.length }}
        />
        <LayerManager />
        <TriagePanel onFocusCamera={(s) => {
          if (s.camera_id) select({ kind: "camera", id: s.camera_id });
          if (s.lat != null && s.lng != null) flyTo(s.lat, s.lng, 12);
        }} />
        <MissionDrawer cameras={inAreaCameras} />
        <Inspector cameras={cameras} />
        <LiveFeed />
      </div>
    </div>
  );
}

function TopStatus({ sweeping, onSweep, counts }: { sweeping: boolean; onSweep: () => void; counts: { hotspots: number; cameras: number; incidents: number; redflag: number; pending: number } }) {
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-[1050] flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-3 py-1.5 shadow-xl backdrop-blur-xl">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Mission Control</span>
      <span className="mx-1 h-3 w-px bg-white/15" />
      <Chip label="Calls" value={counts.incidents} />
      <Chip label="Cams" value={counts.cameras} />
      <Chip label="FIRMS" value={counts.hotspots} tone={counts.hotspots > 0 ? "orange" : undefined} />
      <Chip label="Red Flag" value={counts.redflag} tone={counts.redflag > 0 ? "amber" : undefined} />
      <button onClick={onSweep} disabled={sweeping}
        className="ml-1 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/25 disabled:opacity-50">
        <Sparkles className={`h-3 w-3 ${sweeping ? "animate-pulse" : ""}`} /> Sweep
      </button>
    </div>
  );
}
function Chip({ label, value, tone }: { label: string; value: number; tone?: "orange" | "amber" }) {
  const color = tone === "orange" ? "text-orange-300" : tone === "amber" ? "text-amber-300" : "text-foreground";
  return (
    <span className="text-[11px]">
      <span className="text-muted-foreground">{label} </span>
      <span className={`font-mono font-semibold ${color}`}>{value}</span>
    </span>
  );
}

function FlyController({ target }: { target: { lat: number; lng: number; zoom: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.9 });
  }, [target?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function incidentIcon(statusColor: string, priorityColor: string) {
  return L.divIcon({
    className: "", iconSize: [22, 22], iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${statusColor};box-shadow:0 0 0 2px ${priorityColor},0 0 12px ${statusColor}aa"></div>`,
  });
}
