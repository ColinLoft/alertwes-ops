import { supabase } from "@/integrations/supabase/client";

export type DroneStatus =
  | "ready"
  | "preflight"
  | "inflight"
  | "returning"
  | "charging"
  | "maintenance"
  | "offline";

export interface DroneRow {
  id: string;
  tail_number: string;
  status: DroneStatus;
  battery_pct: number;
  retardant_l: number;
  flight_hours: number;
  last_lat: number | null;
  last_lng: number | null;
  heading_deg: number | null;
  next_service_at: string | null;
  notes: string | null;
  base: { id: string; code: string; name: string; lat: number; lng: number } | null;
  airframe: {
    id: string;
    model: string;
    manufacturer: string | null;
    range_mi: number;
    cruise_speed_mph: number;
    retardant_capacity_l: number;
  } | null;
}

export async function fetchDrones(): Promise<DroneRow[]> {
  const { data, error } = await supabase
    .from("drones")
    .select(
      "id, tail_number, status, battery_pct, retardant_l, flight_hours, last_lat, last_lng, heading_deg, next_service_at, notes, base:bases(id, code, name, lat, lng), airframe:airframes(id, model, manufacturer, range_mi, cruise_speed_mph, retardant_capacity_l)",
    )
    .order("tail_number");
  if (error) throw error;
  return (data ?? []) as unknown as DroneRow[];
}

export interface BaseRow {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  hangar_capacity: number;
  is_hq: boolean;
}

export async function fetchBases(): Promise<BaseRow[]> {
  const { data, error } = await supabase
    .from("bases")
    .select("id, code, name, lat, lng, city, state, hangar_capacity, is_hq")
    .order("name");
  if (error) throw error;
  return (data ?? []) as BaseRow[];
}

export const STATUS_META: Record<DroneStatus, { label: string; color: string; dot: string }> = {
  ready:       { label: "Ready",        color: "#22c55e", dot: "bg-emerald-400" },
  preflight:   { label: "Pre-flight",   color: "#84cc16", dot: "bg-lime-400" },
  inflight:    { label: "In-flight",    color: "#f4a261", dot: "bg-orange-400" },
  returning:   { label: "Returning",    color: "#fbbf24", dot: "bg-amber-400" },
  charging:    { label: "Charging",     color: "#22d3ee", dot: "bg-cyan-400" },
  maintenance: { label: "Maintenance",  color: "#a78bfa", dot: "bg-violet-400" },
  offline:     { label: "Offline",      color: "#64748b", dot: "bg-slate-500" },
};
