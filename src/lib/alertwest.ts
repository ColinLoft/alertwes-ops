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
