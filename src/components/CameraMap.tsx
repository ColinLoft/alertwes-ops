import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { fetchCameras, parseViewLine, type Camera } from "@/lib/alertwest";
import { CameraPanel } from "./CameraPanel";
import { Flame, RefreshCw, Search, X } from "lucide-react";

function makeIcon(active: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="aw-marker${active ? " aw-active" : ""}"></div>`,
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

export function CameraMap() {
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["aw-cameras"],
    queryFn: fetchCameras,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const cameras = data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

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
    return cameras
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.source.toLowerCase().includes(q) ||
          (c.site.county ?? "").toLowerCase().includes(q) ||
          (c.site.state ?? "").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [cameras, query]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/85 px-3 py-2 backdrop-blur-md">
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

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-card/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md sm:flex">
            <span className="inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
            <span className="font-medium text-foreground">{cameras.length}</span>
            <span>cameras</span>
            {dataUpdatedAt > 0 && (
              <span className="ml-2 text-muted-foreground">
                · updated {new Date(dataUpdatedAt).toLocaleTimeString()}
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
            {filtered.map((c) => (
              <button
                key={c.site.id}
                onClick={() => {
                  setSelectedId(c.site.id);
                  setShowSearch(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[c.site.county, c.site.state].filter(Boolean).join(", ") || "—"}
                </span>
              </button>
            ))}
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

        {cameras.map((c) => {
          const lat = Number(c.site.latitude);
          const lng = Number(c.site.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const active = selectedId === c.site.id;
          return (
            <Marker
              key={c.site.id}
              position={[lat, lng]}
              icon={makeIcon(active)}
              eventHandlers={{ click: () => setSelectedId(c.site.id) }}
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
      <CameraPanel camera={selected} onClose={() => setSelectedId(null)} />

      {/* Footer ribbon */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center pb-2">
        <div className="pointer-events-auto rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-md">
          Data via ALERTWest Public API · Not for fire detection
        </div>
      </div>
    </div>
  );
}
