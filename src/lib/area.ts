import { supabase } from "@/integrations/supabase/client";

export type AreaMode = "address" | "region";

export interface DetectionArea {
  id: boolean;
  mode: AreaMode;
  address: string | null;
  center_lat: number;
  center_lng: number;
  radius_mi: number;
  states: string[];
  counties: string[];
  updated_at: string;
}

const R = 3958.8;
export function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function fetchDetectionArea(): Promise<DetectionArea> {
  const { data, error } = await supabase.from("detection_area").select("*").eq("id", true).single();
  if (error) throw error;
  return data as DetectionArea;
}

export async function saveDetectionArea(patch: Partial<DetectionArea>) {
  const { error } = await supabase.from("detection_area").update(patch).eq("id", true);
  if (error) throw error;
}

export async function fetchResponseArea(): Promise<DetectionArea> {
  const { data, error } = await supabase.from("response_area").select("*").eq("id", true).single();
  if (error) throw error;
  return data as DetectionArea;
}

export async function saveResponseArea(patch: Partial<DetectionArea>) {
  const { error } = await supabase.from("response_area").update(patch).eq("id", true);
  if (error) throw error;
}

export interface CandidateLoc {
  lat: number;
  lng: number;
  state?: string | null;
  county?: string | null;
}

export interface AreaBounds {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

const STATE_BOUNDS: Record<string, AreaBounds> = {
  CA: { lamin: 32.5, lomin: -124.5, lamax: 42.1, lomax: -114.1 },
};

const CA_COUNTY_BOUNDS: Record<string, AreaBounds> = {
  alameda: { lamin: 37.4597, lomin: -122.3357, lamax: 37.8982, lomax: -121.4719 },
  alpine: { lamin: 38.3269, lomin: -120.0725, lamax: 38.9333, lomax: -119.5429 },
  amador: { lamin: 38.2213, lomin: -121.0275, lamax: 38.709, lomax: -120.0724 },
  butte: { lamin: 39.2956, lomin: -122.0465, lamax: 40.1519, lomax: -121.0767 },
  calaveras: { lamin: 37.8314, lomin: -120.9955, lamax: 38.5099, lomax: -120.02 },
  colusa: { lamin: 38.9239, lomin: -122.7851, lamax: 39.4145, lomax: -121.8355 },
  contracosta: { lamin: 37.7186, lomin: -122.4301, lamax: 38.0944, lomax: -121.5366 },
  delnorte: { lamin: 41.3808, lomin: -124.256, lamax: 42.0004, lomax: -123.5181 },
  eldorado: { lamin: 38.5031, lomin: -121.141, lamax: 39.0675, lomax: -119.8803 },
  fresno: { lamin: 35.9072, lomin: -120.9187, lamax: 37.5857, lomax: -118.3606 },
  glenn: { lamin: 39.3833, lomin: -122.9377, lamax: 39.7982, lomax: -121.8565 },
  humboldt: { lamin: 40.0013, lomin: -124.4096, lamax: 41.4647, lomax: -123.4083 },
  imperial: { lamin: 32.6183, lomin: -116.1062, lamax: 33.4336, lomax: -114.4629 },
  inyo: { lamin: 35.7892, lomin: -118.7867, lamax: 37.4649, lomax: -115.648 },
  kern: { lamin: 34.7906, lomin: -120.1941, lamax: 35.7973, lomax: -117.6162 },
  kings: { lamin: 35.7892, lomin: -120.3151, lamax: 36.4888, lomax: -119.4746 },
  lake: { lamin: 38.6675, lomin: -123.093, lamax: 39.5807, lomax: -122.3402 },
  lassen: { lamin: 39.7077, lomin: -121.3318, lamax: 41.184, lomax: -119.9959 },
  losangeles: { lamin: 32.8006, lomin: -118.9449, lamax: 34.8225, lomax: -117.6505 },
  madera: { lamin: 36.7697, lomin: -120.5417, lamax: 37.778, lomax: -119.0224 },
  marin: { lamin: 37.8221, lomin: -123.0241, lamax: 38.3169, lomax: -122.4383 },
  mariposa: { lamin: 37.1831, lomin: -120.3919, lamax: 37.9041, lomax: -119.309 },
  mendocino: { lamin: 38.7684, lomin: -124.0239, lamax: 40.0019, lomax: -122.8216 },
  merced: { lamin: 36.7404, lomin: -121.2268, lamax: 37.6334, lomax: -120.0521 },
  modoc: { lamin: 41.1835, lomin: -121.4475, lamax: 41.9972, lomax: -119.9992 },
  mono: { lamin: 37.4631, lomin: -119.6392, lamax: 38.7132, lomax: -117.8327 },
  monterey: { lamin: 35.7893, lomin: -121.9786, lamax: 36.9093, lomax: -120.214 },
  napa: { lamin: 38.155, lomin: -122.6463, lamax: 38.8642, lomax: -122.0648 },
  nevada: { lamin: 39.0052, lomin: -121.2795, lamax: 39.5269, lomax: -120.0031 },
  orange: { lamin: 33.3866, lomin: -118.1167, lamax: 33.9464, lomax: -117.413 },
  placer: { lamin: 38.7115, lomin: -121.4844, lamax: 39.3165, lomax: -120.0025 },
  plumas: { lamin: 39.5973, lomin: -121.4976, lamax: 40.4465, lomax: -120.1088 },
  riverside: { lamin: 33.4259, lomin: -117.6737, lamax: 34.0797, lomax: -114.4349 },
  sacramento: { lamin: 38.0266, lomin: -121.8625, lamax: 38.7364, lomax: -121.0271 },
  sanbenito: { lamin: 36.1968, lomin: -121.644, lamax: 36.9719, lomax: -120.5966 },
  sanbernardino: { lamin: 33.8708, lomin: -117.7833, lamax: 35.8096, lomax: -114.1315 },
  sandiego: { lamin: 32.5342, lomin: -117.5959, lamax: 33.505, lomax: -116.0811 },
  sanfrancisco: { lamin: 37.6894, lomin: -123.0143, lamax: 37.8722, lomax: -122.3568 },
  sanjoaquin: { lamin: 37.4818, lomin: -121.58, lamax: 38.3003, lomax: -120.9207 },
  sanluisobispo: { lamin: 34.8976, lomin: -121.3464, lamax: 35.7952, lomax: -119.4727 },
  sanmateo: { lamin: 37.1073, lomin: -122.5195, lamax: 37.7083, lomax: -122.0815 },
  santabarbara: { lamin: 33.8957, lomin: -120.6708, lamax: 35.1141, lomax: -119.4404 },
  santaclara: { lamin: 36.8992, lomin: -122.1904, lamax: 37.4845, lomax: -121.2154 },
  santacruz: { lamin: 36.8506, lomin: -122.3177, lamax: 37.2861, lomax: -121.5814 },
  shasta: { lamin: 40.287, lomin: -123.0688, lamax: 41.1839, lomax: -121.32 },
  sierra: { lamin: 39.3916, lomin: -121.0344, lamax: 39.7759, lomax: -120.0013 },
  siskiyou: { lamin: 40.994, lomin: -123.7191, lamax: 42.0095, lomax: -121.4465 },
  solano: { lamin: 38.0357, lomin: -122.407, lamax: 38.5334, lomax: -121.5933 },
  sonoma: { lamin: 38.1098, lomin: -123.5335, lamax: 38.8524, lomax: -122.379 },
  stanislaus: { lamin: 37.1348, lomin: -121.4726, lamax: 38.0774, lomax: -120.3873 },
  sutter: { lamin: 38.7346, lomin: -121.9455, lamax: 39.3039, lomax: -121.4149 },
  tehama: { lamin: 39.7976, lomin: -123.0654, lamax: 40.4456, lomax: -121.3456 },
  trinity: { lamin: 39.977, lomin: -123.6238, lamax: 41.359, lomax: -122.4455 },
  tulare: { lamin: 35.7892, lomin: -119.5732, lamax: 36.7448, lomax: -117.9808 },
  tuolumne: { lamin: 37.6337, lomin: -120.6527, lamax: 38.4335, lomax: -119.2003 },
  ventura: { lamin: 33.2154, lomin: -119.5789, lamax: 34.9013, lomax: -118.6335 },
  yolo: { lamin: 38.3131, lomin: -122.3951, lamax: 38.9245, lomax: -121.5041 },
  yuba: { lamin: 38.9389, lomin: -121.6238, lamax: 39.6395, lomax: -121.0095 },
};

function normRegion(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+county$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function containsPoint(bounds: AreaBounds, loc: { lat: number; lng: number }) {
  return loc.lat >= bounds.lamin && loc.lat <= bounds.lamax && loc.lng >= bounds.lomin && loc.lng <= bounds.lomax;
}

/** Contracts a bbox toward its center by `pct` (e.g. 0.18 = 18% inset) so adjacent-county overlap is reduced for point-in-area checks. */
function containsPointInset(bounds: AreaBounds, loc: { lat: number; lng: number }, pct = 0.18) {
  const dLat = (bounds.lamax - bounds.lamin) * pct;
  const dLng = (bounds.lomax - bounds.lomin) * pct;
  return (
    loc.lat >= bounds.lamin + dLat &&
    loc.lat <= bounds.lamax - dLat &&
    loc.lng >= bounds.lomin + dLng &&
    loc.lng <= bounds.lomax - dLng
  );
}

function radiusBounds(area: DetectionArea): AreaBounds {
  const lat = Number(area.center_lat);
  const lng = Number(area.center_lng);
  const radius = Number(area.radius_mi);
  const latDelta = radius / 69;
  const lngDelta = radius / (69 * Math.max(0.25, Math.cos((lat * Math.PI) / 180)));
  return { lamin: lat - latDelta, lomin: lng - lngDelta, lamax: lat + latDelta, lomax: lng + lngDelta };
}

export function getDetectionAreaBounds(area: DetectionArea | null | undefined): AreaBounds[] {
  if (!area) return [];
  if (area.mode === "address") return [radiusBounds(area)];
  const countyBounds = (area.counties ?? [])
    .map((county) => CA_COUNTY_BOUNDS[normRegion(county)])
    .filter(Boolean) as AreaBounds[];
  if (countyBounds.length) return countyBounds;
  return (area.states ?? []).map((state) => STATE_BOUNDS[state.toUpperCase()]).filter(Boolean) as AreaBounds[];
}

export function getDetectionAreaCenter(area: DetectionArea | null | undefined): { lat: number; lng: number } {
  if (!area) return { lat: 37.5, lng: -119 };
  const lat = Number(area.center_lat);
  const lng = Number(area.center_lng);
  if (area.mode === "address" && Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  const bounds = getDetectionAreaBounds(area)[0];
  if (bounds) return { lat: (bounds.lamin + bounds.lamax) / 2, lng: (bounds.lomin + bounds.lomax) / 2 };
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  return { lat: 37.5, lng: -119 };
}

export function isRegionTextInDetectionArea(areaDesc: string | null | undefined, area: DetectionArea | null | undefined): boolean {
  if (!area) return false;
  const text = (areaDesc ?? "").toLowerCase();
  if (!text) return false;
  const selectedCounties = (area.counties ?? []).map(normRegion);
  if (selectedCounties.length) {
    const normalizedText = normRegion(text);
    return selectedCounties.some((county) => normalizedText.includes(county));
  }
  const selectedStates = (area.states ?? []).map((s) => s.toUpperCase());
  return selectedStates.some((state) => new RegExp(`\\b${state}\\b`, "i").test(text));
}

export function isInDetectionArea(loc: CandidateLoc, area: DetectionArea | null | undefined): boolean {
  if (!area) return false;
  if (area.mode === "address" || (!area.states?.length && !area.counties?.length)) {
    return area.radius_mi > 0 &&
      haversineMi({ lat: Number(area.center_lat), lng: Number(area.center_lng) }, loc) <= Number(area.radius_mi);
  }
  // region mode
  const selectedStates = (area.states ?? []).map((s) => s.toUpperCase());
  const selectedCounties = (area.counties ?? []).map(normRegion);
  const stateMatch = selectedStates.length > 0 && loc.state ? selectedStates.includes(loc.state.toUpperCase()) : false;
  const countyMatch = selectedCounties.length > 0 && loc.county ? selectedCounties.includes(normRegion(loc.county)) : false;
  // permissive if no location metadata available — fall back to radius
  if (!loc.state && !loc.county) {
    const bounds = getDetectionAreaBounds(area);
    if (bounds.length) return bounds.some((b) => containsPoint(b, loc));
    return area.radius_mi > 0 &&
      haversineMi({ lat: Number(area.center_lat), lng: Number(area.center_lng) }, loc) <= Number(area.radius_mi);
  }
  // If counties are selected, they narrow the state instead of selecting the whole state.
  if (selectedCounties.length > 0) {
    if (countyMatch) return true;
    // For points without county metadata, use inset bbox to reduce neighboring-county overlap.
    return getDetectionAreaBounds(area).some((b) => containsPointInset(b, loc));
  }
  return stateMatch;
}
