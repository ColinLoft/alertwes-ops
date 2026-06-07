import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchCameras } from "@/lib/alertwest";
import { haversineMi } from "@/lib/area";

const SYSTEM = `You are a wildfire detection analyst examining a wildfire watch camera frame.
Reply ONLY with strict JSON of shape: {"label":"fire"|"smoke"|"clear","confidence":0-100,"reasoning":"one short sentence"}.
- "fire": visible active flames or active fire glow.
- "smoke": visible smoke plume rising from terrain (not clouds, not fog, not haze on horizon).
- "clear": no signs of smoke or fire.
Be conservative: prefer "clear" unless you can point to specific visual evidence. Cloud cover, fog banks, sun glare, lens dust/water spots, and lens artifacts are NOT smoke.`;

interface CameraCandidate {
  id: string;
  name: string;
  url: string;
  time: string;
  lat: number;
  lng: number;
  state: string | null;
  county: string | null;
}

async function analyze(c: CameraCandidate, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: `Camera ${c.name} at ${c.lat.toFixed(3)},${c.lng.toFixed(3)}.` },
            { type: "image_url", image_url: { url: c.url } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const j: any = await res.json();
  let parsed: any = {};
  try { parsed = JSON.parse(j?.choices?.[0]?.message?.content ?? "{}"); } catch {}
  const label = ["fire", "smoke", "clear"].includes(parsed.label) ? parsed.label : "clear";
  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
  return { label, confidence, reasoning: String(parsed.reasoning ?? "").slice(0, 240) };
}

export const Route = createFileRoute("/api/public/hooks/sweep-cameras")({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "LOVABLE_API_KEY missing" }, { status: 500 });

        // Detection area
        const { data: area, error: aErr } = await supabaseAdmin
          .from("detection_area").select("*").eq("id", true).single();
        if (aErr || !area) return Response.json({ error: "no detection area" }, { status: 500 });

        const states = new Set<string>((area.states ?? []).map((s: string) => s.toUpperCase()));
        const counties = new Set<string>(area.counties ?? []);
        const center = { lat: Number(area.center_lat), lng: Number(area.center_lng) };
        const radius = Number(area.radius_mi) || 0;

        // Muted (active mutes only)
        const { data: muted } = await supabaseAdmin
          .from("muted_cameras").select("camera_id,muted_until");
        const mutedSet = new Set<string>();
        const nowMs = Date.now();
        for (const m of muted ?? []) {
          if (new Date(m.muted_until).getTime() > nowMs) mutedSet.add(m.camera_id);
        }

        // Cameras (fresh frame, in area, not muted)
        let cams: any[];
        try { cams = await fetchCameras(); }
        catch (e: any) { return Response.json({ error: `cameras: ${e?.message}` }, { status: 502 }); }

        const candidates: CameraCandidate[] = [];
        for (const c of cams) {
          if (!c.image?.url || !c.image?.time) continue;
          if (mutedSet.has(c.site.id)) continue;
          const lat = Number(c.site.latitude), lng = Number(c.site.longitude);
          if (!isFinite(lat) || !isFinite(lng)) continue;
          const ageMin = (nowMs - new Date(c.image.time).getTime()) / 60000;
          if (ageMin > 30 || ageMin < 0) continue; // only frames in the last 30 min
          const stateUp = (c.site.state ?? "").toUpperCase();
          const inRadius = radius > 0 && haversineMi(center, { lat, lng }) <= radius;
          const inState = states.size > 0 && stateUp && states.has(stateUp);
          const inCounty = counties.size > 0 && c.site.county && counties.has(c.site.county);
          if (!(inRadius || inState || inCounty)) continue;
          candidates.push({
            id: c.site.id, name: c.name, url: c.image.url, time: c.image.time,
            lat, lng, state: c.site.state, county: c.site.county,
          });
        }

        // Skip frames already analyzed (unique on camera_id,image_time)
        const ids = candidates.map((c) => c.id);
        const { data: existing } = await supabaseAdmin
          .from("incident_suggestions").select("camera_id,image_time")
          .in("camera_id", ids);
        const seen = new Set<string>();
        for (const row of existing ?? []) seen.add(`${row.camera_id}|${row.image_time}`);
        const fresh = candidates.filter((c) => !seen.has(`${c.id}|${c.time}`));

        // Bound cost: up to 40 cameras per sweep
        const work = fresh.slice(0, 40);

        let analyzed = 0, created = 0;
        const errors: string[] = [];
        await Promise.all(work.map(async (c) => {
          try {
            const r = await analyze(c, apiKey);
            analyzed++;
            if (r.label === "clear" || r.confidence < 60) return;
            const { error } = await supabaseAdmin.from("incident_suggestions").insert({
              source: "camera", camera_id: c.id, camera_name: c.name,
              lat: c.lat, lng: c.lng, state: c.state, county: c.county,
              image_url: c.url, image_time: c.time,
              label: r.label, confidence: r.confidence, reasoning: r.reasoning,
              status: "pending",
            });
            if (!error) created++;
            else if (!String(error.message).toLowerCase().includes("duplicate")) {
              errors.push(`${c.id}: ${error.message}`);
            }
          } catch (e: any) { errors.push(`${c.id}: ${e?.message ?? "fail"}`); }
        }));

        return Response.json({
          ok: true, area_radius: radius, candidates: candidates.length,
          analyzed, created, skipped_muted: mutedSet.size, errors: errors.slice(0, 5),
        });
      },
    },
  },
});
