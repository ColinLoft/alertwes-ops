import { createServerFn } from "@tanstack/react-start";

export interface WindObs {
  station: string;
  name: string;
  distance_mi: number;
  observed_at: string;
  wind_speed_mph: number | null;
  wind_dir_deg: number | null;
  wind_gust_mph: number | null;
  temp_f: number | null;
  rh_pct: number | null;
}

type CacheEntry = { obs: WindObs; at: number };
const cache = new Map<string, CacheEntry>();
const FRESH_MS = 10 * 60_000;   // serve directly
const STALE_MS = 60 * 60_000;   // serve as fallback on error

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOpenMeteo(lat: number, lng: number): Promise<{ ok: true; obs: WindObs } | { ok: false; status: number; error: string }> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    wind_speed_unit: "mph",
    temperature_unit: "fahrenheit",
    timezone: "UTC",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) return { ok: false, status: res.status, error: `Open-Meteo ${res.status}` };
  const json: any = await res.json();
  const c = json?.current;
  if (!c) return { ok: false, status: 0, error: "No current data" };
  const obs: WindObs = {
    station: "open-meteo",
    name: "Open-Meteo grid",
    distance_mi: 0,
    observed_at: c.time ?? "",
    wind_speed_mph: c.wind_speed_10m ?? null,
    wind_dir_deg: c.wind_direction_10m ?? null,
    wind_gust_mph: c.wind_gusts_10m ?? null,
    temp_f: c.temperature_2m ?? null,
    rh_pct: c.relative_humidity_2m ?? null,
  };
  return { ok: true, obs };
}

export const getWindAtPoint = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number }) => {
    if (typeof d?.lat !== "number" || typeof d?.lng !== "number") throw new Error("lat/lng required");
    return d;
  })
  .handler(async ({ data }) => {
    // Round to ~0.1° so nearby incidents share the same cache slot.
    const rLat = Math.round(data.lat * 10) / 10;
    const rLng = Math.round(data.lng * 10) / 10;
    const key = `${rLat},${rLng}`;
    const now = Date.now();

    const hit = cache.get(key);
    if (hit && now - hit.at < FRESH_MS) return { obs: hit.obs };

    try {
      let r = await fetchOpenMeteo(rLat, rLng);
      if (!r.ok && r.status === 429) {
        await sleep(600 + Math.floor(Math.random() * 500));
        r = await fetchOpenMeteo(rLat, rLng);
      }
      if (r.ok) {
        cache.set(key, { obs: r.obs, at: now });
        return { obs: r.obs };
      }
      // fallback to stale cache
      if (hit && now - hit.at < STALE_MS) return { obs: hit.obs, error: "cached (upstream busy)" };
      if (r.status === 429) return { obs: null as WindObs | null, error: "Weather service busy — retrying shortly" };
      return { obs: null, error: r.error };
    } catch (e) {
      if (hit && now - hit.at < STALE_MS) return { obs: hit.obs, error: "cached (network error)" };
      return { obs: null as WindObs | null, error: (e as Error).message };
    }
  });
