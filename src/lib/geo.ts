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

/** Geocode an address via OpenStreetMap Nominatim. No API key required. */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const tryQuery = async (q: string) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    if (!data.length) return null;
    return { display_name: data[0].display_name, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  };
  const q = query.trim();
  return (await tryQuery(q)) ?? (await tryQuery(q.replace(/\s+/g, " ").replace(/,\s*USA?$/i, "") + ", USA"));
}
