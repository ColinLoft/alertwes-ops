import { createServerFn } from "@tanstack/react-start";

export interface NwsAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  areaDesc: string;
  effective: string;
  expires: string;
  /** Centroid of the alert polygon (best-effort) */
  lat: number | null;
  lng: number | null;
  /** Two-letter US state codes parsed from areaDesc, e.g. ["CA","OR"] */
  states: string[];
}

let cache: { at: number; data: NwsAlert[] } | null = null;
const TTL_MS = 60_000;

function flatCoords(g: any): Array<[number, number]> {
  if (!g) return [];
  const out: Array<[number, number]> = [];
  const walk = (n: any) => {
    if (!Array.isArray(n)) return;
    if (typeof n[0] === "number" && typeof n[1] === "number") {
      out.push([n[0], n[1]]);
      return;
    }
    for (const c of n) walk(c);
  };
  walk(g.coordinates);
  return out;
}

function parseStates(areaDesc: string): string[] {
  // areaDesc is typically "Foo County, CA; Bar County, OR"
  const out = new Set<string>();
  const re = /,\s*([A-Z]{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(areaDesc)) !== null) out.add(m[1]);
  return [...out];
}

export const getRedFlagAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return { alerts: cache.data, cached: true };
  try {
    const res = await fetch(
      "https://api.weather.gov/alerts/active?event=Red%20Flag%20Warning",
      { headers: { "User-Agent": "AegisCommand (ops@aegiscommand.local)", Accept: "application/geo+json" } },
    );
    if (!res.ok) return { alerts: cache?.data ?? [], error: `NWS ${res.status}` };
    const json: any = await res.json();
    const alerts: NwsAlert[] = (json.features ?? []).map((f: any) => {
      const coords = flatCoords(f.geometry);
      let lat: number | null = null, lng: number | null = null;
      if (coords.length) {
        let sx = 0, sy = 0;
        for (const [x, y] of coords) { sx += x; sy += y; }
        lng = sx / coords.length;
        lat = sy / coords.length;
      }
      const areaDesc: string = f.properties?.areaDesc ?? "";
      return {
        id: f.id,
        event: f.properties?.event ?? "",
        headline: f.properties?.headline ?? "",
        severity: f.properties?.severity ?? "",
        areaDesc,
        effective: f.properties?.effective ?? "",
        expires: f.properties?.expires ?? "",
        lat, lng,
        states: parseStates(areaDesc),
      };
    });
    cache = { at: now, data: alerts };
    return { alerts, cached: false };
  } catch (e) {
    return { alerts: cache?.data ?? [], error: (e as Error).message };
  }
});

