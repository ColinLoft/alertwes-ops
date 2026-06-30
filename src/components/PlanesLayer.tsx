import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { fetchPlanes, mToFt, msToKt, type Bbox, type Plane } from "@/lib/opensky";
import { haversineMi, bearingDeg } from "@/lib/geo";
import { publishPlanes } from "@/lib/planes-bus";
import type { RadiusFilter } from "@/lib/settings";

const PLANE_HIT = 44;

const iconCache = new Map<string, L.DivIcon>();
function planeIcon(headingDeg: number, onGround: boolean) {
  const rounded = Math.round(headingDeg / 5) * 5;
  const key = `${rounded}|${onGround ? 1 : 0}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const color = onGround ? "#fde68a" : "#facc15";
  const svg = `
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <path fill="currentColor" stroke="rgba(0,0,0,0.55)" stroke-width="0.8" stroke-linejoin="round"
        d="M16 1.5c-1.05 0-1.7 1.1-1.85 2.4l-.35 6.2L2 17.2v2.4l11.8-3 .15 6.1-3.4 2.2v1.9l5.45-1.4 5.45 1.4v-1.9l-3.4-2.2.15-6.1L30 19.6v-2.4l-11.8-6.6-.35-6.2C17.7 2.6 17.05 1.5 16 1.5z"/>
    </svg>`;
  const icon = L.divIcon({
    className: "",
    html: `<div class="aw-hit"><div class="aw-plane" style="--pc:${color}; transform: rotate(${rounded}deg)" role="img" aria-label="Aircraft">${svg}</div></div>`,
    iconSize: [PLANE_HIT, PLANE_HIT],
    iconAnchor: [PLANE_HIT / 2, PLANE_HIT / 2],
  });
  iconCache.set(key, icon);
  return icon;
}

function getBbox(map: L.Map): Bbox {
  const b = map.getBounds();
  return {
    lamin: b.getSouth(),
    lomin: b.getWest(),
    lamax: b.getNorth(),
    lomax: b.getEast(),
  };
}

function compass(deg: number | null): string {
  if (deg == null) return "—";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return `${dirs[Math.round(deg / 22.5) % 16]} ${Math.round(deg)}°`;
}

interface ContactBadge {
  label: string;
  cls: string;
}

function contactBadge(unixSec: number): ContactBadge {
  if (!unixSec) return { label: "No signal", cls: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
  const diff = Math.max(0, Date.now() / 1000 - unixSec);
  if (diff < 30) return { label: `Live · ${Math.round(diff)}s`, cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
  if (diff < 120) return { label: `Recent · ${Math.round(diff)}s`, cls: "bg-amber-500/20 text-amber-200 border-amber-500/40" };
  if (diff < 600) return { label: `Stale · ${Math.round(diff / 60)}m`, cls: "bg-orange-500/20 text-orange-300 border-orange-500/40" };
  return { label: `Outdated · ${Math.round(diff / 60)}m`, cls: "bg-rose-500/25 text-rose-300 border-rose-500/40" };
}

export interface PlaneBounds {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

export function PlanesLayer({
  refreshSeconds = 20,
  radius = null,
  bounds = null,
  fixedBbox = null,
}: {
  refreshSeconds?: number;
  radius?: RadiusFilter | null;
  bounds?: PlaneBounds[] | null;
  /** When set, query this bbox regardless of map viewport so zoom doesn't make planes disappear. */
  fixedBbox?: Bbox | null;
}) {
  const map = useMap();
  const [viewBbox, setViewBbox] = useState<Bbox>(() => getBbox(map));
  const [center, setCenter] = useState(() => {
    const c = map.getCenter();
    return { lat: c.lat, lng: c.lng };
  });

  useEffect(() => {
    setViewBbox(getBbox(map));
    const c = map.getCenter();
    setCenter({ lat: c.lat, lng: c.lng });
  }, [map]);

  const throttleRef = useRef<number | null>(null);
  const scheduleUpdate = () => {
    if (throttleRef.current != null) return;
    throttleRef.current = window.setTimeout(() => {
      throttleRef.current = null;
      setViewBbox(getBbox(map));
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
    }, 180);
  };
  useEffect(() => () => {
    if (throttleRef.current != null) window.clearTimeout(throttleRef.current);
  }, []);

  useMapEvents({
    moveend: scheduleUpdate,
    zoomend: scheduleUpdate,
  });

  const queryBbox = fixedBbox ?? viewBbox;

  const { data } = useQuery({
    queryKey: ["planes", queryBbox.lamin.toFixed(2), queryBbox.lomin.toFixed(2), queryBbox.lamax.toFixed(2), queryBbox.lomax.toFixed(2)],
    queryFn: ({ signal }) => fetchPlanes(queryBbox, signal),
    refetchInterval: Math.max(10, refreshSeconds) * 1000,
    staleTime: 8_000,
    retry: 1,
  });

  const planes = useMemo<Plane[]>(() => {
    let arr: Plane[] = data ?? [];
    if (radius) {
      arr = arr.filter(
        (p) => haversineMi({ lat: p.lat, lng: p.lng }, { lat: radius.lat, lng: radius.lng }) <= radius.km,
      );
    }
    if (bounds && bounds.length) {
      arr = arr.filter((p) =>
        bounds.some(
          (b) => p.lat >= b.lamin && p.lat <= b.lamax && p.lng >= b.lomin && p.lng <= b.lomax,
        ),
      );
    }
    return arr;
  }, [data, radius, bounds]);

  // Publish currently-rendered planes so the search box (and other UI) can use them.
  useEffect(() => {
    publishPlanes(planes);
  }, [planes]);


  return (
    <>
      {radius && (
        <Circle
          center={[radius.lat, radius.lng]}
          radius={radius.km * 1609.344}
          interactive={false}
          pathOptions={{
            color: "#facc15",
            weight: 1.25,
            opacity: 0.6,
            fillOpacity: 0.04,
            dashArray: "3 5",
          }}
        />
      )}
      {planes.map((p) => {
        const vr = p.verticalRateMs;
        const trend = vr == null ? "Level" : vr > 0.5 ? "Climbing" : vr < -0.5 ? "Descending" : "Level";
        const distMi = haversineMi({ lat: p.lat, lng: p.lng }, center);
        const brg = bearingDeg(center, { lat: p.lat, lng: p.lng });
        const badge = contactBadge(p.lastContact);
        return (
          <Marker
            key={p.icao24}
            position={[p.lat, p.lng]}
            icon={planeIcon(p.trueTrackDeg ?? 0, p.onGround)}
            keyboard={false}
            interactive
          >
            <Popup>
              <div className="aw-popup min-w-[230px]">
                <div className="aw-popup-head">
                  <div className="text-sm font-semibold tracking-wide">
                    {p.callsign || p.icao24.toUpperCase()}
                  </div>
                  <span className={`aw-popup-badge ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.originCountry || "Unknown origin"} · {p.onGround ? "On ground" : "Airborne"}
                </div>
                <div className="aw-popup-meta">
                  <div className="aw-popup-meta-label">From map center</div>
                  <div className="font-semibold">
                    {distMi.toFixed(1)} mi · {compass(brg)}
                  </div>
                </div>
                <dl className="aw-popup-grid">
                  <dt>ICAO24</dt><dd className="font-mono">{p.icao24.toUpperCase()}</dd>
                  <dt>Squawk</dt><dd className="font-mono">{p.squawk ?? "—"}</dd>
                  <dt>Baro alt</dt><dd>{mToFt(p.baroAltitudeM) != null ? `${mToFt(p.baroAltitudeM)!.toLocaleString()} ft` : "—"}</dd>
                  <dt>GPS alt</dt><dd>{mToFt(p.geoAltitudeM) != null ? `${mToFt(p.geoAltitudeM)!.toLocaleString()} ft` : "—"}</dd>
                  <dt>Ground speed</dt><dd>{msToKt(p.velocityMs) != null ? `${msToKt(p.velocityMs)} kt` : "—"}</dd>
                  <dt>Vertical</dt>
                  <dd>{vr != null ? `${vr > 0 ? "+" : ""}${Math.round(vr * 196.85)} fpm` : "—"} · {trend}</dd>
                  <dt>Heading</dt><dd>{compass(p.trueTrackDeg)}</dd>
                  <dt>Position</dt><dd className="font-mono">{p.lat.toFixed(3)}, {p.lng.toFixed(3)}</dd>
                </dl>
                <div className="aw-popup-actions">
                  <a
                    href={`https://globe.adsbexchange.com/?icao=${p.icao24}`}
                    target="_blank"
                    rel="noreferrer"
                    className="aw-popup-btn"
                  >
                    ADS-B Exchange
                  </a>
                  <a
                    href={`https://www.flightradar24.com/${p.callsign || ""}`.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="aw-popup-btn"
                  >
                    Flightradar24
                  </a>
                </div>
              </div>
            </Popup>

          </Marker>
        );
      })}
    </>
  );
}
