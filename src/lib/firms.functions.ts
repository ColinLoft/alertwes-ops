import { createServerFn } from "@tanstack/react-start";

export interface FirmsHotspot {
  lat: number;
  lng: number;
  bright_ti4: number;
  frp: number;
  confidence: string;
  acq_datetime: string;
  satellite: string;
  daynight: string;
}

let cache: { at: number; data: FirmsHotspot[] } | null = null;
const TTL_MS = 15 * 60 * 1000;

// CONUS bbox: W,S,E,N. Day range max is 5.
const BBOX = "-125,24,-66,50";
const SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_SNPP_NRT"] as const;
const DAYS = 2;

export const getFirmsHotspots = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return { hotspots: cache.data, cached: true };

  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return { hotspots: [], error: "FIRMS_MAP_KEY missing" };

  const out: FirmsHotspot[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  try {
    for (const src of SOURCES) {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${src}/${BBOX}/${DAYS}`;
      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`${src} ${res.status}`);
        continue;
      }
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) continue;
      const header = lines[0].split(",");
      const idx = (n: string) => header.indexOf(n);
      const iLat = idx("latitude"),
        iLng = idx("longitude"),
        iBri = idx("bright_ti4"),
        iFrp = idx("frp"),
        iConf = idx("confidence"),
        iDate = idx("acq_date"),
        iTime = idx("acq_time"),
        iSat = idx("satellite"),
        iDN = idx("daynight");
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(",");
        const lat = Number(c[iLat]);
        const lng = Number(c[iLng]);
        if (!isFinite(lat) || !isFinite(lng)) continue;
        const t = (c[iTime] ?? "0000").padStart(4, "0");
        const dt = `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`;
        // Dedup near-duplicate detections across satellites
        const dedupKey = `${lat.toFixed(3)}|${lng.toFixed(3)}|${c[iDate]}|${t.slice(0, 2)}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        out.push({
          lat,
          lng,
          bright_ti4: Number(c[iBri]) || 0,
          frp: Number(c[iFrp]) || 0,
          confidence: (c[iConf] ?? "").trim(),
          acq_datetime: dt,
          satellite: c[iSat] ?? "",
          daynight: c[iDN] ?? "",
        });
      }
    }
    cache = { at: now, data: out };
    return { hotspots: out, cached: false, error: errors.length ? errors.join("; ") : undefined };
  } catch (e) {
    return { hotspots: cache?.data ?? [], error: (e as Error).message };
  }
});
