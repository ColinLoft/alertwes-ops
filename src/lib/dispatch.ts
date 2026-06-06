import { supabase } from "@/integrations/supabase/client";
import type { DroneRow } from "./drones";
import type { IncidentRow } from "./incidents";

const R_MI = 3958.8;
export function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(h));
}

export interface DroneCandidate {
  drone: DroneRow;
  distance_mi: number;
  eta_min: number;
  in_range: boolean;
  ready: boolean;
  battery_ok: boolean;
  retardant_ok: boolean;
  reasons: string[];
}

export function rankCandidates(drones: DroneRow[], incident: IncidentRow): DroneCandidate[] {
  return drones
    .map<DroneCandidate>((d) => {
      const origin = d.last_lat != null && d.last_lng != null
        ? { lat: Number(d.last_lat), lng: Number(d.last_lng) }
        : d.base
          ? { lat: Number(d.base.lat), lng: Number(d.base.lng) }
          : null;
      const distance_mi = origin ? haversineMi(origin, { lat: Number(incident.lat), lng: Number(incident.lng) }) : Infinity;
      const cruise = d.airframe?.cruise_speed_mph ?? 90;
      const range = d.airframe?.range_mi ?? 100;
      const eta_min = isFinite(distance_mi) ? (distance_mi / cruise) * 60 : Infinity;
      const ready = d.status === "ready";
      const battery_ok = (d.battery_pct ?? 0) >= 40;
      const retardant_ok = (d.retardant_l ?? 0) > 0;
      // Need round-trip range with 20% reserve
      const in_range = distance_mi * 2 <= range * 0.8;
      const reasons: string[] = [];
      if (!ready) reasons.push(`status: ${d.status}`);
      if (!battery_ok) reasons.push(`battery ${d.battery_pct}%`);
      if (!retardant_ok) reasons.push("no retardant");
      if (!in_range) reasons.push(`out of range (${distance_mi.toFixed(0)} mi / ${range} mi)`);
      return { drone: d, distance_mi, eta_min, in_range, ready, battery_ok, retardant_ok, reasons };
    })
    .sort((a, b) => {
      // Eligible first, then by ETA
      const aOk = a.ready && a.in_range && a.battery_ok ? 0 : 1;
      const bOk = b.ready && b.in_range && b.battery_ok ? 0 : 1;
      if (aOk !== bOk) return aOk - bOk;
      return a.eta_min - b.eta_min;
    });
}

export async function assignDroneToIncident(incidentId: string, droneId: string, etaMin: number, distMi: number) {
  const { error: e1 } = await supabase
    .from("incidents")
    .update({ assigned_drone_id: droneId, status: "dispatched" })
    .eq("id", incidentId);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("drones")
    .update({ status: "preflight" })
    .eq("id", droneId);
  if (e2) throw e2;
  await supabase.from("incident_events").insert({
    incident_id: incidentId,
    event_type: "dispatched",
    message: `Drone dispatched · ${distMi.toFixed(1)} mi · ETA ${etaMin.toFixed(0)} min`,
    payload: { drone_id: droneId, distance_mi: distMi, eta_min: etaMin },
  });
}

export async function releaseDroneFromIncident(incidentId: string, droneId: string | null) {
  const { error } = await supabase
    .from("incidents")
    .update({ assigned_drone_id: null })
    .eq("id", incidentId);
  if (error) throw error;
  if (droneId) {
    await supabase.from("drones").update({ status: "ready" }).eq("id", droneId);
  }
  await supabase.from("incident_events").insert({
    incident_id: incidentId,
    event_type: "released",
    message: "Drone released",
  });
}

export async function markDroneInflight(droneId: string, incidentId: string) {
  const { error } = await supabase.from("drones").update({ status: "inflight" }).eq("id", droneId);
  if (error) throw error;
  await supabase.from("incident_events").insert({
    incident_id: incidentId,
    event_type: "inflight",
    message: "Drone in-flight to scene",
  });
}
