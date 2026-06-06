import { createServerFn } from "@tanstack/react-start";

export interface FirmsHotspot {
  lat: number;
  lng: number;
  bright_ti4: number;
  frp: number;
  confidence: string; // 'l'|'n'|'h' for VIIRS
  acq_datetime: string;
  satellite: string;
  daynight: string;
}

// In-worker cache (per worker instance)
let cache: { at: number; data: FirmsHotspot[] } | null = null;
const TTL_MS = 15 * 60 * 1000; // 15 min

const AREAS = [
  // Western US bbox: W,S,E,N
  "-125,32,-114,49",
];

export const getFirmsHotspots = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return { hotspots: cache.data, cached: true };

  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return { hotspots: [], error: "FIRMS_MAP_KEY missing" };

  const hotspots: FirmsHotspot[] = [];
  try {
    for (const bbox of AREAS) {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${bbox}/1`;
      const res = await fetch(url);
      if (!res.ok) continue;
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
        hotspots.push({
          lat,
          lng,
          bright_ti4: Number(c[iBri]) || 0,
          frp: Number(c[iFrp]) || 0,
          confidence: (c[iConf] ?? "").trim(),
          acq_datetime: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`,
          satellite: c[iSat] ?? "",
          daynight: c[iDN] ?? "",
        });
      }
    }
    cache = { at: now, data: hotspots };
    return { hotspots, cached: false };
  } catch (e) {
    return { hotspots: cache?.data ?? [], error: (e as Error).message };
  }
});
