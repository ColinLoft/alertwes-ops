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
    const token = process.env.SYNOPTIC_TOKEN;
    if (!token) return { obs: null as WindObs | null, error: "SYNOPTIC_TOKEN missing" };
    try {
      const params = new URLSearchParams({
        token,
        radius: `${data.lat},${data.lng},30`,
        vars: "wind_speed,wind_direction,wind_gust,air_temp,relative_humidity",
        within: "120",
        limit: "1",
        units: "english",
      });
      const url = `https://api.synopticdata.com/v2/stations/latest?${params}`;
      const res = await fetch(url);
      if (!res.ok) return { obs: null, error: `Synoptic ${res.status}` };
      const json: any = await res.json();
      const st = json?.STATION?.[0];
      if (!st) return { obs: null };
      const ob = st.OBSERVATIONS ?? {};
      const num = (v: any) => (typeof v === "number" ? v : v == null ? null : Number(v));
      const obs: WindObs = {
        station: st.STID ?? "",
        name: st.NAME ?? "",
        distance_mi: Number(st.DISTANCE) || 0,
        observed_at: ob.wind_speed_value_1?.date_time ?? ob.air_temp_value_1?.date_time ?? "",
        wind_speed_mph: num(ob.wind_speed_value_1?.value),
        wind_dir_deg: num(ob.wind_direction_value_1?.value),
        wind_gust_mph: num(ob.wind_gust_value_1?.value),
        temp_f: num(ob.air_temp_value_1?.value),
        rh_pct: num(ob.relative_humidity_value_1?.value),
      };
      // Synoptic 'english' units already returns mph; guard if not.
      if (obs.wind_speed_mph && obs.wind_speed_mph < 0.01) obs.wind_speed_mph = null;
      void MS_TO_MPH;
      return { obs };
    } catch (e) {
      return { obs: null, error: (e as Error).message };
    }
  });
