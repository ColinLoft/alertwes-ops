import { supabase } from "@/integrations/supabase/client";

export interface DetectionArea {
  id: boolean;
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

export interface CandidateLoc {
  lat: number;
  lng: number;
  state?: string | null;
  county?: string | null;
}

export function isInDetectionArea(loc: CandidateLoc, area: DetectionArea | null | undefined): boolean {
  if (!area) return false;
  const inRadius =
    area.radius_mi > 0 &&
    haversineMi({ lat: area.center_lat, lng: area.center_lng }, loc) <= area.radius_mi;
  const stateMatch =
    area.states.length > 0 && loc.state ? area.states.includes(loc.state) : false;
  const countyMatch =
    area.counties.length > 0 && loc.county ? area.counties.includes(loc.county) : false;
  // Permissive OR: matches if inside radius OR matches state/county
  return inRadius || stateMatch || countyMatch;
}
