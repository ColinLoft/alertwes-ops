import { useEffect, useState } from "react";
import { Circle, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { fetchPlanes, mToFt, msToKt, type Bbox, type Plane } from "@/lib/opensky";
import { haversineMi, bearingDeg } from "@/lib/geo";
import { publishPlanes } from "@/lib/planes-bus";
import type { RadiusFilter } from "@/lib/settings";

function planeIcon(headingDeg: number, onGround: boolean) {
  const color = onGround ? "#fde68a" : "#facc15";
  const svg = `
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <path fill="currentColor" stroke="rgba(0,0,0,0.55)" stroke-width="0.8" stroke-linejoin="round"
        d="M16 1.5c-1.05 0-1.7 1.1-1.85 2.4l-.35 6.2L2 17.2v2.4l11.8-3 .15 6.1-3.4 2.2v1.9l5.45-1.4 5.45 1.4v-1.9l-3.4-2.2.15-6.1L30 19.6v-2.4l-11.8-6.6-.35-6.2C17.7 2.6 17.05 1.5 16 1.5z"/>
    </svg>`;
  return L.divIcon({
    className: "",
    html: `<div class="aw-plane" style="--pc:${color}; transform: rotate(${headingDeg}deg)" role="img" aria-label="Aircraft heading ${Math.round(headingDeg)} degrees">${svg}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
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
}: {
  refreshSeconds?: number;
  radius?: RadiusFilter | null;
  bounds?: PlaneBounds[] | null;
}) {
  const map = useMap();
  const [bbox, setBbox] = useState<Bbox>(() => getBbox(map));
  const [center, setCenter] = useState(() => {
    const c = map.getCenter();
    return { lat: c.lat, lng: c.lng };
  });

  useEffect(() => {
    setBbox(getBbox(map));
    const c = map.getCenter();
    setCenter({ lat: c.lat, lng: c.lng });
  }, [map]);

  useMapEvents({
    moveend: () => {
      setBbox(getBbox(map));
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
    },
    zoomend: () => setBbox(getBbox(map)),
  });

  const { data } = useQuery({
    queryKey: ["planes", bbox.lamin.toFixed(2), bbox.lomin.toFixed(2), bbox.lamax.toFixed(2), bbox.lomax.toFixed(2)],
    queryFn: ({ signal }) => fetchPlanes(bbox, signal),
    refetchInterval: Math.max(10, refreshSeconds) * 1000,
    staleTime: 8_000,
    retry: 1,
  });

  const all: Plane[] = data ?? [];
  let planes = all;
  if (radius) {
    planes = planes.filter(
      (p) => haversineMi({ lat: p.lat, lng: p.lng }, { lat: radius.lat, lng: radius.lng }) <= radius.km,
    );
  }
  if (bounds && bounds.length) {
    planes = planes.filter((p) =>
      bounds.some(
        (b) => p.lat >= b.lamin && p.lat <= b.lamax && p.lng >= b.lomin && p.lng <= b.lomax,
      ),
    );
  }

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
              <div className="text-xs leading-relaxed">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold tracking-wide">
                    {p.callsign || p.icao24.toUpperCase()}
                  </div>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="text-muted-foreground">{p.originCountry || "Unknown origin"}</div>
                <div className="mt-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From map center</div>
                  <div className="font-semibold">{distMi.toFixed(1)} mi · {compass(brg)}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <span className="text-muted-foreground">ICAO24</span>
                  <span className="font-mono">{p.icao24.toUpperCase()}</span>
                  <span className="text-muted-foreground">Squawk</span>
                  <span className="font-mono">{p.squawk ?? "—"}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span>{p.onGround ? "On ground" : "Airborne"}</span>
                  <span className="text-muted-foreground">Baro alt</span>
                  <span>{mToFt(p.baroAltitudeM) != null ? `${mToFt(p.baroAltitudeM)!.toLocaleString()} ft` : "—"}</span>
                  <span className="text-muted-foreground">GPS alt</span>
                  <span>{mToFt(p.geoAltitudeM) != null ? `${mToFt(p.geoAltitudeM)!.toLocaleString()} ft` : "—"}</span>
                  <span className="text-muted-foreground">Ground speed</span>
                  <span>{msToKt(p.velocityMs) != null ? `${msToKt(p.velocityMs)} kt` : "—"}</span>
                  <span className="text-muted-foreground">Vertical</span>
                  <span>
                    {vr != null ? `${vr > 0 ? "+" : ""}${Math.round(vr * 196.85)} fpm` : "—"} · {trend}
                  </span>
                  <span className="text-muted-foreground">Heading</span>
                  <span>{compass(p.trueTrackDeg)}</span>
                  <span className="text-muted-foreground">Position</span>
                  <span className="font-mono">{p.lat.toFixed(3)}, {p.lng.toFixed(3)}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <a
                    href={`https://globe.adsbexchange.com/?icao=${p.icao24}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    ADS-B Exchange
                  </a>
                  <a
                    href={`https://www.flightradar24.com/${p.callsign || ""}`.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
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
