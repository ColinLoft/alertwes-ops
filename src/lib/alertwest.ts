export interface Camera {
  name: string;
  source: string;
  site: {
    id: string;
    description: string | null;
    latitude: string;
    longitude: string;
    altitude: string | null;
    county: string | null;
    state: string | null;
    time: string | null;
  };
  image: { time: string | null; url: string | null };
  position: { time: string | null; pan: string | null; tilt: string | null; zoom: string | null };
  parameters: {
    time: string | null;
    "Properties.System.SerialNumber": string | null;
    "Brand.Brand": string | null;
    "Brand.ProdNbr": string | null;
  };
  view: { time: string | null; line: string | null };
}

export async function fetchCameras(): Promise<Camera[]> {
  const res = await fetch("https://api.cdn.prod.alertwest.com/api/firecams/v0/cameras");
  if (!res.ok) throw new Error(`Failed to load cameras: ${res.status}`);
  return res.json();
}

export function parseViewLine(line: string | null): [number, number][] | null {
  if (!line) return null;
  const parts = line.trim().split(/\s+/);
  const coords: [number, number][] = [];
  for (const p of parts) {
    const [lat, lng] = p.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push([lat, lng]);
  }
  return coords.length >= 2 ? coords : null;
}

export type Status = "online" | "stale" | "offline" | "unknown";

export interface StatusInfo {
  status: Status;
  ageMs: number | null;
  label: string;
  color: string;
  signal: 0 | 1 | 2 | 3 | 4; // 0=unknown, 1-4 bars
}

export function getStatus(camera: Camera): StatusInfo {
  const t = camera.image.time ?? camera.position.time ?? camera.site.time;
  if (!t) return { status: "unknown", ageMs: null, label: "Unknown", color: "#94a3b8", signal: 0 };
  const ageMs = Date.now() - new Date(t).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0)
    return { status: "unknown", ageMs: null, label: "Unknown", color: "#94a3b8", signal: 0 };

  const min = ageMs / 60000;
  if (min < 15) return { status: "online", ageMs, label: "Online", color: "#22c55e", signal: 4 };
  if (min < 60) return { status: "online", ageMs, label: "Online", color: "#84cc16", signal: 3 };
  if (min < 180) return { status: "stale", ageMs, label: "Stale", color: "#f4a261", signal: 2 };
  if (min < 24 * 60) return { status: "stale", ageMs, label: "Stale", color: "#f59e0b", signal: 1 };
  return { status: "offline", ageMs, label: "Offline", color: "#ef4444", signal: 0 };
}

export function relTime(s: string | Date | null | undefined): string | null {
  if (!s) return null;
  const d = typeof s === "string" ? new Date(s).getTime() : s.getTime();
  if (!Number.isFinite(d)) return null;
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
