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

const MS_TO_MPH = 2.23694;

export const getWindAtPoint = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number }) => {
    if (typeof d?.lat !== "number" || typeof d?.lng !== "number") throw new Error("lat/lng required");
    return d;
  })
  .handler(async ({ data }) => {
    // Open-Meteo — keyless, no 403s. Returns current wind + temp/RH near the point.
    try {
      const params = new URLSearchParams({
        latitude: String(data.lat),
        longitude: String(data.lng),
        current: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        wind_speed_unit: "mph",
        temperature_unit: "fahrenheit",
        timezone: "UTC",
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) return { obs: null as WindObs | null, error: `Open-Meteo ${res.status}` };
      const json: any = await res.json();
      const c = json?.current;
      if (!c) return { obs: null };
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
      void MS_TO_MPH;
      return { obs };
    } catch (e) {
      return { obs: null, error: (e as Error).message };
    }
  });
