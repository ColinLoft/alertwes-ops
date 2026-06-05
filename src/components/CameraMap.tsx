import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { fetchCameras, getStatus, parseViewLine, relTime, type Camera } from "@/lib/alertwest";
import { CameraPanel } from "./CameraPanel";
import { useCameraHistory } from "@/hooks/useCameraHistory";
import { AlertTriangle, Flame, Keyboard, RefreshCw, Search, Settings as SettingsIcon, WifiOff, X } from "lucide-react";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { dispatchTimeline } from "@/lib/timeline-bus";
import { useSettings } from "@/lib/settings";
import { haversineKm } from "@/lib/geo";

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
  const [settings] = useSettings();
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt, failureCount } = useQuery({
    queryKey: ["aw-cameras"],
    queryFn: fetchCameras,
    refetchInterval: Math.max(15, settings.refreshSeconds) * 1000,
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

  // Apply filters from settings (state / county / radius)
  const visibleCameras = useMemo(() => {
    const stateSet = new Set(settings.states.map((s) => s.toLowerCase()));
    const countySet = new Set(settings.counties.map((s) => s.toLowerCase()));
    return cameras.filter((c) => {
      if (stateSet.size && !(c.site.state && stateSet.has(c.site.state.toLowerCase()))) return false;
      if (countySet.size && !(c.site.county && countySet.has(c.site.county.toLowerCase()))) return false;
      if (settings.radius) {
        const lat = Number(c.site.latitude);
        const lng = Number(c.site.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        const d = haversineKm({ lat, lng }, { lat: settings.radius.lat, lng: settings.radius.lng });
        if (d > settings.radius.km) return false;
      }
      return true;
    });
  }, [cameras, settings.states, settings.counties, settings.radius]);

  // Auto-open nearest camera when radius is set
  useEffect(() => {
    if (!settings.autoOpenNearest || !settings.radius || selectedId) return;
    if (visibleCameras.length === 0) return;
    const center = { lat: settings.radius.lat, lng: settings.radius.lng };
    let best: { id: string; d: number } | null = null;
    for (const c of visibleCameras) {
      const lat = Number(c.site.latitude);
      const lng = Number(c.site.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const d = haversineKm(center, { lat, lng });
      if (!best || d < best.d) best = { id: c.site.id, d };
    }
    if (best) setSelectedId(best.id);
    // intentionally only react when radius identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.radius, settings.autoOpenNearest, visibleCameras.length]);


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

  const [showHelp, setShowHelp] = useState(false);

  // Global keyboard shortcuts
  useGlobalShortcuts((e) => {
    const key = e.key;

    // Open search: "/" or Cmd/Ctrl+K
    if (key === "/" || ((e.metaKey || e.ctrlKey) && key.toLowerCase() === "k")) {
      e.preventDefault();
      setShowSearch(true);
      return;
    }

    if (key === "Escape") {
      if (showHelp) { setShowHelp(false); return; }
      if (showSearch) { setShowSearch(false); setQuery(""); return; }
      if (selectedId) { setSelectedId(null); return; }
      return;
    }

    if (key === "?") {
      e.preventDefault();
      setShowHelp((v) => !v);
      return;
    }

    if (key === "r" || key === "R") {
      e.preventDefault();
      refetch();
      return;
    }

    // Camera navigation
    if (key === "j" || key === "ArrowRight" || key === "k" || key === "ArrowLeft") {
      if (visibleCameras.length === 0) return;
      e.preventDefault();
      const dir = key === "j" || key === "ArrowRight" ? 1 : -1;
      const idx = visibleCameras.findIndex((c) => c.site.id === selectedId);
      const next = idx === -1
        ? (dir > 0 ? 0 : visibleCameras.length - 1)
        : (idx + dir + visibleCameras.length) % visibleCameras.length;
      setSelectedId(visibleCameras[next].site.id);
      return;
    }

    // Timeline controls (only meaningful when a camera is selected)
    if (!selectedId) return;
    if (key === " " || key === "Spacebar") {
      e.preventDefault();
      dispatchTimeline("toggle");
    } else if (key === "." || key === ">") {
      e.preventDefault();
      dispatchTimeline("next");
    } else if (key === "," || key === "<") {
      e.preventDefault();
      dispatchTimeline("prev");
    } else if (key === "l" || key === "L") {
      e.preventDefault();
      dispatchTimeline("live");
    }
  });


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

          <FilterSummary settings={settings} count={visibleCameras.length} total={cameras.length} />
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
            aria-label="Search cameras"
            aria-expanded={showSearch}
            aria-controls="aw-search-popover"
            className="rounded-lg border border-border bg-card/85 p-2 text-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-card/85 p-2 text-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/settings"
            aria-label="Open settings"
            className="rounded-lg border border-border bg-card/85 p-2 text-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <SettingsIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Search dropdown */}
      {showSearch && (
        <div id="aw-search-popover" role="dialog" aria-label="Search cameras" className="absolute right-3 top-16 z-[1000] w-[min(360px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card/95 p-2 backdrop-blur-md sm:right-4">
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

      {/* Offline / error banners */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute inset-x-0 top-[88px] z-[1000] flex flex-col items-center gap-2 px-3 sm:top-20"
      >
        {!online && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-100 backdrop-blur-md">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            <span>You're offline. Showing the last successful snapshot.</span>
            {dataUpdatedAt > 0 && (
              <span className="text-amber-200/80">· {relTime(new Date(dataUpdatedAt))}</span>
            )}
          </div>
        )}
        {error && online && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive-foreground backdrop-blur-md">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>
              Couldn't reach the ALERTWest API
              {failureCount > 1 ? ` (attempt ${failureCount})` : ""}.
              {dataUpdatedAt > 0
                ? ` Showing data from ${relTime(new Date(dataUpdatedAt))}.`
                : ""}
            </span>
            <button
              onClick={() => refetch()}
              className="rounded-md border border-destructive/50 bg-destructive/30 px-2 py-0.5 text-[11px] font-semibold hover:bg-destructive/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              Retry now
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div
          role="status"
          className="absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card/90 px-4 py-3 text-sm text-muted-foreground backdrop-blur-md"
        >
          Loading camera network…
        </div>
      )}

      {/* Detail panel */}
      <CameraPanel
        camera={selected}
        onClose={() => setSelectedId(null)}
        history={selected ? history[selected.site.id] ?? [] : []}
      />

      {/* Footer ribbon + keyboard help */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex items-center justify-center gap-2 pb-2">
        <button
          onClick={() => setShowHelp((v) => !v)}
          aria-label="Show keyboard shortcuts"
          aria-expanded={showHelp}
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-md hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Keyboard className="h-3 w-3" aria-hidden="true" />
          ? Shortcuts
        </button>
        <div className="pointer-events-auto rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-md">
          California · ALERTWest Public API · Not for fire detection
        </div>
      </div>

      {showHelp && (
        <div
          role="dialog"
          aria-label="Keyboard shortcuts"
          className="absolute inset-0 z-[1100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
              <button
                onClick={() => setShowHelp(false)}
                aria-label="Close shortcuts"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-1.5 text-xs">
              {[
                ["/ or ⌘K", "Open search"],
                ["J / →", "Next camera"],
                ["K / ←", "Previous camera"],
                ["Space", "Play / pause timeline"],
                [". / ,", "Next / previous frame"],
                ["L", "Return to live frame"],
                ["R", "Refresh data"],
                ["Esc", "Close panel / search"],
                ["?", "Toggle this help"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    {k}
                  </kbd>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
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
