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

function normRegion(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+county$/i, "")
    .replace(/[^a-z0-9]/g, "");
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
    return area.radius_mi > 0 &&
      haversineMi({ lat: Number(area.center_lat), lng: Number(area.center_lng) }, loc) <= Number(area.radius_mi);
  }
  // If counties are selected, they narrow the state instead of selecting the whole state.
  if (selectedCounties.length > 0) return countyMatch;
  return stateMatch;
}
