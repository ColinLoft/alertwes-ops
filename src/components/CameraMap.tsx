import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { fetchCameras, getStatus, parseViewLine, relTime, type Camera, type Status } from "@/lib/alertwest";
import { CameraPanel } from "./CameraPanel";
import { FilterBar, emptyFilters, type Filters } from "./FilterBar";
import { useCameraHistory } from "@/hooks/useCameraHistory";
import { AlertTriangle, Flame, RefreshCw, Search, WifiOff, X } from "lucide-react";

function makeIcon(color: string, active: boolean, pulse: boolean, label: string) {
  const safe = label.replace(/"/g, "&quot;");
  return L.divIcon({
    className: "",
    html: `<div class="aw-marker${active ? " aw-active" : ""}${pulse ? " aw-pulse" : ""}" style="--mc:${color}" role="button" tabindex="0" aria-label="${safe}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 11), { duration: 0.8 });
  }, [target, map]);
  return null;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function CameraMap() {
  const online = useOnlineStatus();
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt, failureCount } = useQuery({
    queryKey: ["aw-cameras"],
    queryFn: fetchCameras,
    refetchInterval: 60_000,
    staleTime: 30_000,
    // Exponential backoff retry on failure (per-fetch). React Query also keeps last good data.
    retry: 4,
    retryDelay: (attempt) => Math.min(30_000, 1000 * 2 ** attempt),
    refetchOnWindowFocus: true,
  });

  // Auto-retry once when the browser comes back online
  useEffect(() => {
    if (online && error) refetch();
  }, [online, error, refetch]);



  const cameras = useMemo(() => data ?? [], [data]);
  const history = useCameraHistory(cameras, dataUpdatedAt);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters());

  // Pre-compute statuses
  const statusMap = useMemo(() => {
    const m = new Map<string, Status>();
    for (const c of cameras) m.set(c.site.id, getStatus(c).status);
    return m;
  }, [cameras]);

  // Apply filters
  const visibleCameras = useMemo(() => {
    return cameras.filter((c) => {
      if (filters.states.size && !(c.site.state && filters.states.has(c.site.state))) return false;
      if (filters.counties.size && !(c.site.county && filters.counties.has(c.site.county))) return false;
      const brand = c.parameters["Brand.Brand"];
      if (filters.brands.size && !(brand && filters.brands.has(brand))) return false;
      if (filters.statuses.size) {
        const s = statusMap.get(c.site.id) ?? "unknown";
        if (!filters.statuses.has(s)) return false;
      }
      return true;
    });
  }, [cameras, filters, statusMap]);

  const selected = useMemo(
    () => cameras.find((c) => c.site.id === selectedId) ?? null,
    [cameras, selectedId],
  );

  const flyTarget = useMemo<[number, number] | null>(
    () =>
      selected
        ? [Number(selected.site.latitude), Number(selected.site.longitude)]
        : null,
    [selected],
  );

  const viewLine = useMemo(
    () => (selected ? parseViewLine(selected.view.line) : null),
    [selected],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return [] as Camera[];
    const q = query.toLowerCase();
    return visibleCameras
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.source.toLowerCase().includes(q) ||
          (c.site.county ?? "").toLowerCase().includes(q) ||
          (c.site.state ?? "").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [visibleCameras, query]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/85 px-3 py-2 backdrop-blur-md">
            <Flame className="h-5 w-5 text-primary" />
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">
                ALERT<span className="text-primary">West</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Wildfire Camera Network
              </div>
            </div>
          </div>

          <FilterBar
            cameras={cameras}
            filters={filters}
            onChange={setFilters}
            cameraStatuses={statusMap}
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-card/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md sm:flex">
            <span className="font-medium text-foreground" aria-label={`${visibleCameras.length} of ${cameras.length} cameras visible`}>
              {visibleCameras.length}
            </span>
            <span>/ {cameras.length}</span>
            <span className="ml-1 inline-flex items-center gap-1" aria-hidden="true">
              <Legend color="#22c55e" />
              <Legend color="#f4a261" />
              <Legend color="#ef4444" />
            </span>
            {dataUpdatedAt > 0 && (
              <span
                className="ml-2"
                title={`Last successful fetch: ${new Date(dataUpdatedAt).toLocaleString()}`}
              >
                · last fetch {relTime(new Date(dataUpdatedAt))}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="rounded-lg border border-border bg-card/85 p-2 text-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Search cameras"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-card/85 p-2 text-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Search dropdown */}
      {showSearch && (
        <div className="absolute right-3 top-16 z-[1000] w-[min(360px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card/95 p-2 backdrop-blur-md sm:right-4">
          <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, county, state…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setQuery("");
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && query && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matches
              </div>
            )}
            {filtered.map((c) => {
              const s = getStatus(c);
              return (
                <button
                  key={c.site.id}
                  onClick={() => {
                    setSelectedId(c.site.id);
                    setShowSearch(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.site.county, c.site.state].filter(Boolean).join(", ") || "—"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={[39.5, -120.5]}
        zoom={6}
        scrollWheelZoom
        className="h-full w-full"
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyTo target={flyTarget} />

        {visibleCameras.map((c) => {
          const lat = Number(c.site.latitude);
          const lng = Number(c.site.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const active = selectedId === c.site.id;
          const s = getStatus(c);
          const label = `${c.name}${c.site.county || c.site.state ? ` — ${[c.site.county, c.site.state].filter(Boolean).join(", ")}` : ""} (${s.label})`;
          return (
            <Marker
              key={c.site.id}
              position={[lat, lng]}
              icon={makeIcon(s.color, active, s.status === "online", label)}
              keyboard
              alt={label}
              title={label}
              eventHandlers={{
                click: () => setSelectedId(c.site.id),
                keydown: (ev) => {
                  const oe = (ev as unknown as { originalEvent: KeyboardEvent }).originalEvent;
                  if (oe && (oe.key === "Enter" || oe.key === " ")) {
                    oe.preventDefault();
                    setSelectedId(c.site.id);
                  }
                },
              }}
            />
          );
        })}

        {viewLine && (
          <Polyline
            positions={viewLine}
            pathOptions={{ color: "#f4a261", weight: 3, opacity: 0.9, dashArray: "6 6" }}
          />
        )}
      </MapContainer>

      {/* Status messages */}
      {isLoading && (
        <div className="absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card/90 px-4 py-3 text-sm text-muted-foreground backdrop-blur-md">
          Loading camera network…
        </div>
      )}
      {error && (
        <div className="absolute left-1/2 top-20 z-[1000] -translate-x-1/2 rounded-lg border border-destructive/40 bg-destructive/20 px-4 py-2 text-sm text-destructive-foreground backdrop-blur-md">
          Failed to load cameras
        </div>
      )}

      {/* Detail panel */}
      <CameraPanel
        camera={selected}
        onClose={() => setSelectedId(null)}
        history={selected ? history[selected.site.id] ?? [] : []}
      />

      {/* Footer ribbon */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center pb-2">
        <div className="pointer-events-auto rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-md">
          Data via ALERTWest Public API · Not for fire detection
        </div>
      </div>
    </div>
  );
}

function Legend({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}
