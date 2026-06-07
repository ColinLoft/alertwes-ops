import { supabase } from "@/integrations/supabase/client";

export interface SuggestionRow {
  id: string;
  source: string;
  camera_id: string | null;
  camera_name: string | null;
  lat: number;
  lng: number;
  state: string | null;
  county: string | null;
  label: "smoke" | "fire" | "clear";
  confidence: number;
  reasoning: string | null;
  image_url: string | null;
  image_time: string | null;
  status: "pending" | "promoted" | "dismissed";
  incident_id: string | null;
  created_at: string;
}

export async function fetchPendingSuggestions(): Promise<SuggestionRow[]> {
  const { data, error } = await supabase
    .from("incident_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as SuggestionRow[];
}

export async function dismissSuggestion(id: string) {
  const { error } = await supabase
    .from("incident_suggestions")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function promoteSuggestion(s: SuggestionRow): Promise<string> {
  const priority = s.label === "fire" ? (s.confidence >= 80 ? "p1" : "p2") : "p3";
  const { data: inc, error: e1 } = await supabase
    .from("incidents")
    .insert({
      title: `${s.label === "fire" ? "Fire" : "Smoke"} – ${s.camera_name ?? "Camera"}`,
      source: "alertwest",
      status: "new",
      priority,
      confidence: s.confidence,
      lat: s.lat,
      lng: s.lng,
      state: s.state,
      county: s.county,
      external_id: s.id,
      notes: s.reasoning ?? null,
    })
    .select("id")
    .single();
  if (e1) throw e1;
  await supabase
    .from("incident_suggestions")
    .update({ status: "promoted", incident_id: inc!.id, resolved_at: new Date().toISOString() })
    .eq("id", s.id);
  await supabase.from("incident_events").insert({
    incident_id: inc!.id,
    event_type: "created",
    message: `Promoted from AI camera detection (${s.label}, ${s.confidence}%)`,
  });
  return inc!.id;
}
