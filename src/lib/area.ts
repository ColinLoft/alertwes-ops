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
  fresno: { lamin: 35.88, lomin: -120.93, lamax: 37.59, lomax: -118.35 },
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
    return getDetectionAreaBounds(area).some((b) => containsPoint(b, loc));
  }
  return stateMatch;
}
