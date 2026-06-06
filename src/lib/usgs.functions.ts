import { createServerFn } from "@tanstack/react-start";

export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number;
  lat: number;
  lng: number;
  depth: number;
  url: string;
}

let cache: { at: number; data: Quake[] } | null = null;
const TTL_MS = 60_000;

export const getRecentQuakes = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return { quakes: cache.data, cached: true };
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    );
    if (!res.ok) return { quakes: cache?.data ?? [], error: `USGS ${res.status}` };
    const json: any = await res.json();
    const quakes: Quake[] = (json.features ?? []).map((f: any) => ({
      id: f.id,
      mag: f.properties?.mag ?? 0,
      place: f.properties?.place ?? "",
      time: f.properties?.time ?? 0,
      url: f.properties?.url ?? "",
      lng: f.geometry?.coordinates?.[0] ?? 0,
      lat: f.geometry?.coordinates?.[1] ?? 0,
      depth: f.geometry?.coordinates?.[2] ?? 0,
    }));
    cache = { at: now, data: quakes };
    return { quakes, cached: false };
  } catch (e) {
    return { quakes: cache?.data ?? [], error: (e as Error).message };
  }
});
