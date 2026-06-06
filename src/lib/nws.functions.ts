import { createServerFn } from "@tanstack/react-start";

export interface NwsAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  areaDesc: string;
  effective: string;
  expires: string;
}

let cache: { at: number; data: NwsAlert[] } | null = null;
const TTL_MS = 60_000;

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
    const alerts: NwsAlert[] = (json.features ?? []).map((f: any) => ({
      id: f.id,
      event: f.properties?.event ?? "",
      headline: f.properties?.headline ?? "",
      severity: f.properties?.severity ?? "",
      areaDesc: f.properties?.areaDesc ?? "",
      effective: f.properties?.effective ?? "",
      expires: f.properties?.expires ?? "",
    }));
    cache = { at: now, data: alerts };
    return { alerts, cached: false };
  } catch (e) {
    return { alerts: cache?.data ?? [], error: (e as Error).message };
  }
});
