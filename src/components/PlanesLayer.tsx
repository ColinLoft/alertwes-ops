import { useEffect, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { fetchPlanes, mToFt, msToKt, type Bbox, type Plane } from "@/lib/opensky";

function planeIcon(headingDeg: number, onGround: boolean) {
  const color = onGround ? "#94a3b8" : "#7dd3fc";
  return L.divIcon({
    className: "",
    html: `<div class="aw-plane" style="--pc:${color}; transform: rotate(${headingDeg}deg)" role="img" aria-label="Aircraft heading ${Math.round(headingDeg)} degrees">
      <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2l1.6 8.2L22 12l-8.4 1.8L12 22l-1.6-8.2L2 12l8.4-1.8L12 2z"/></svg>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
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

export function PlanesLayer({ refreshSeconds = 20 }: { refreshSeconds?: number }) {
  const map = useMap();
  const [bbox, setBbox] = useState<Bbox>(() => getBbox(map));

  useEffect(() => {
    setBbox(getBbox(map));
  }, [map]);

  useMapEvents({
    moveend: () => setBbox(getBbox(map)),
    zoomend: () => setBbox(getBbox(map)),
  });

  const { data } = useQuery({
    queryKey: ["planes", bbox.lamin.toFixed(2), bbox.lomin.toFixed(2), bbox.lamax.toFixed(2), bbox.lomax.toFixed(2)],
    queryFn: ({ signal }) => fetchPlanes(bbox, signal),
    refetchInterval: Math.max(10, refreshSeconds) * 1000,
    staleTime: 8_000,
    retry: 1,
  });

  const planes: Plane[] = data ?? [];

  return (
    <>
      {planes.map((p) => (
        <Marker
          key={p.icao24}
          position={[p.lat, p.lng]}
          icon={planeIcon(p.trueTrackDeg ?? 0, p.onGround)}
          keyboard={false}
          interactive
        >
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{p.callsign || p.icao24.toUpperCase()}</div>
              <div className="text-muted-foreground">{p.originCountry}</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span>Alt</span><span>{mToFt(p.baroAltitudeM) ?? "—"} ft</span>
                <span>Speed</span><span>{msToKt(p.velocityMs) ?? "—"} kt</span>
                <span>Heading</span><span>{p.trueTrackDeg != null ? `${Math.round(p.trueTrackDeg)}°` : "—"}</span>
                <span>Status</span><span>{p.onGround ? "On ground" : "Airborne"}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
