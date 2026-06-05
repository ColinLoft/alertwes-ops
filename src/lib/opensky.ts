// OpenSky Network — public REST API for live aircraft states.
// https://openskynetwork.github.io/opensky-api/rest.html
// Anonymous access is rate-limited (~10s/bbox). Be a good citizen and poll slowly.

export interface Plane {
  icao24: string;
  callsign: string;
  originCountry: string;
  lng: number;
  lat: number;
  baroAltitudeM: number | null; // meters
  geoAltitudeM: number | null;
  velocityMs: number | null; // m/s
  trueTrackDeg: number | null; // 0 = north, clockwise
  verticalRateMs: number | null;
  onGround: boolean;
  lastContact: number; // unix seconds
  squawk: string | null;
}

export interface Bbox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

export async function fetchPlanes(bbox: Bbox, signal?: AbortSignal): Promise<Plane[]> {
  const url = new URL("/api/planes", typeof window !== "undefined" ? window.location.origin : "http://localhost");
  url.searchParams.set("lamin", bbox.lamin.toFixed(4));
  url.searchParams.set("lomin", bbox.lomin.toFixed(4));
  url.searchParams.set("lamax", bbox.lamax.toFixed(4));
  url.searchParams.set("lomax", bbox.lomax.toFixed(4));
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  const json = (await res.json()) as { states: unknown[][] | null };
  const rows = json.states ?? [];
  const planes: Plane[] = [];
  for (const r of rows) {
    const lng = r[5] as number | null;
    const lat = r[6] as number | null;
    if (lng == null || lat == null) continue;
    planes.push({
      icao24: String(r[0] ?? "").trim(),
      callsign: String(r[1] ?? "").trim(),
      originCountry: String(r[2] ?? ""),
      lng,
      lat,
      baroAltitudeM: (r[7] as number | null) ?? null,
      onGround: Boolean(r[8]),
      velocityMs: (r[9] as number | null) ?? null,
      trueTrackDeg: (r[10] as number | null) ?? null,
      verticalRateMs: (r[11] as number | null) ?? null,
      geoAltitudeM: (r[13] as number | null) ?? null,
      squawk: (r[14] as string | null) ?? null,
      lastContact: (r[4] as number) ?? 0,
    });
  }
  return planes;
}

export const mToFt = (m: number | null) => (m == null ? null : Math.round(m * 3.28084));
export const msToKt = (v: number | null) => (v == null ? null : Math.round(v * 1.94384));
