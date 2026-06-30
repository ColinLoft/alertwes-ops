export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const KM_PER_MI = 1.609344;
export const haversineMi = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => haversineKm(a, b) / KM_PER_MI;

/** Destination point given start, bearing (deg), and distance (miles). */
export function destinationPointMi(
  start: { lat: number; lng: number },
  bearingDegrees: number,
  distMi: number,
): { lat: number; lng: number } {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const delta = distMi / R;
  const theta = toRad(bearingDegrees);
  const phi1 = toRad(start.lat);
  const lam1 = toRad(start.lng);
  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(sinPhi2);
  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * sinPhi2;
  const lam2 = lam1 + Math.atan2(y, x);
  return { lat: toDeg(phi2), lng: ((toDeg(lam2) + 540) % 360) - 180 };
}

/** Initial bearing in degrees (0 = north, clockwise) from a → b. */
export function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lng: number;
}

/** Geocode an address. Tries Nominatim, then Photon (Komoot) as a fallback. */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  const variants = [q, /,\s*USA?$/i.test(q) ? q : `${q}, USA`];

  // Nominatim
  for (const v of variants) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(v)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        if (data?.length) return { display_name: data[0].display_name, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch { /* fall through */ }
  }
  // Photon fallback
  for (const v of variants) {
    try {
      const url = `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(v)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data: any = await res.json();
        const f = data?.features?.[0];
        if (f?.geometry?.coordinates) {
          const [lng, lat] = f.geometry.coordinates;
          const name = [f.properties?.name, f.properties?.city, f.properties?.state, f.properties?.country].filter(Boolean).join(", ");
          return { display_name: name || v, lat, lng };
        }
      }
    } catch { /* ignore */ }
  }
  return null;
}
