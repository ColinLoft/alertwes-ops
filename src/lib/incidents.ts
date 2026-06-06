import { supabase } from "@/integrations/supabase/client";

export type IncidentStatus = "new" | "triaging" | "dispatched" | "onscene" | "contained" | "closed" | "false_positive";
export type IncidentPriority = "p1" | "p2" | "p3" | "p4";
export type IncidentSource = "alertwest" | "firms" | "nws" | "user" | "manual" | "other";

export interface IncidentRow {
  id: string;
  external_id: string | null;
  title: string;
  source: IncidentSource;
  status: IncidentStatus;
  priority: IncidentPriority;
  confidence: number | null;
  lat: number;
  lng: number;
  county: string | null;
  state: string | null;
  discovered_at: string;
  acreage: number | null;
  frp: number | null;
  assigned_drone_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  event_type: string;
  message: string | null;
  payload: any;
  actor: string | null;
  created_at: string;
}

export const STATUS_META: Record<IncidentStatus, { label: string; color: string }> = {
  new:            { label: "New",           color: "#ef4444" },
  triaging:       { label: "Triaging",      color: "#f59e0b" },
  dispatched:     { label: "Dispatched",    color: "#3b82f6" },
  onscene:        { label: "On Scene",      color: "#22c55e" },
  contained:      { label: "Contained",     color: "#06b6d4" },
  closed:         { label: "Closed",        color: "#64748b" },
  false_positive: { label: "False Positive", color: "#475569" },
};

export const PRIORITY_META: Record<IncidentPriority, { label: string; color: string }> = {
  p1: { label: "P1", color: "#ef4444" },
  p2: { label: "P2", color: "#f97316" },
  p3: { label: "P3", color: "#eab308" },
  p4: { label: "P4", color: "#64748b" },
};

export async function fetchIncidents(): Promise<IncidentRow[]> {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .order("discovered_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as IncidentRow[];
}

export async function fetchIncidentEvents(incidentId: string): Promise<IncidentEvent[]> {
  const { data, error } = await supabase
    .from("incident_events")
    .select("*")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as IncidentEvent[];
}

export async function createIncidentFromHotspot(input: {
  lat: number;
  lng: number;
  frp?: number | null;
  confidence?: string | null;
  source?: IncidentSource;
  title?: string;
}): Promise<IncidentRow> {
  const priority: IncidentPriority =
    (input.frp ?? 0) > 50 ? "p1" : (input.frp ?? 0) > 20 ? "p2" : "p3";
  const conf =
    input.confidence === "h" ? 90 : input.confidence === "n" ? 65 : input.confidence === "l" ? 35 : null;
  const title =
    input.title ?? `FIRMS detection ${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}`;
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      title,
      source: input.source ?? "firms",
      status: "new",
      priority,
      confidence: conf,
      lat: input.lat,
      lng: input.lng,
      frp: input.frp ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await supabase.from("incident_events").insert({
    incident_id: data.id,
    event_type: "created",
    message: `Incident opened from ${input.source ?? "firms"}`,
  });
  return data as IncidentRow;
}

export async function updateIncidentStatus(id: string, status: IncidentStatus) {
  const { error } = await supabase.from("incidents").update({ status }).eq("id", id);
  if (error) throw error;
  await supabase.from("incident_events").insert({
    incident_id: id,
    event_type: "status_change",
    message: `Status → ${status}`,
  });
}
