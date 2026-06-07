import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface CameraInput {
  camera_id: string;
  camera_name: string;
  image_url: string;
  image_time: string;
  lat: number;
  lng: number;
  state?: string | null;
  county?: string | null;
}

const SYSTEM = `You are a wildfire detection analyst examining a wildfire watch camera frame.
Reply ONLY with strict JSON of shape: {"label":"fire"|"smoke"|"clear","confidence":0-100,"reasoning":"one short sentence"}.
- "fire": visible active flames or active fire glow.
- "smoke": visible smoke plume rising from terrain (not clouds, not fog, not haze on horizon).
- "clear": no signs of smoke or fire.
Be conservative: prefer "clear" unless you can point to specific visual evidence. Cloud cover, fog banks, sun glare, and lens artifacts are NOT smoke.`;

async function analyzeOne(input: CameraInput, apiKey: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: `Camera ${input.camera_name} at ${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}. Analyze for smoke or fire.` },
            { type: "image_url", image_url: { url: input.image_url } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${text.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const raw = j?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const label = ["fire", "smoke", "clear"].includes(parsed.label) ? parsed.label : "clear";
  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
  return { label, confidence, reasoning: String(parsed.reasoning ?? "").slice(0, 240) };
}

export const sweepCameras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cameras: CameraInput[] }) => {
    if (!Array.isArray(d?.cameras)) throw new Error("cameras required");
    return { cameras: d.cameras.slice(0, 12) }; // hard cap to keep request bounded
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { created: 0, errors: ["LOVABLE_API_KEY missing"], analyzed: 0 };

    const supabase = context.supabase;
    const created: string[] = [];
    const errors: string[] = [];
    let analyzed = 0;

    for (const cam of data.cameras) {
      try {
        const result = await analyzeOne(cam, apiKey);
        analyzed++;
        if (result.label === "clear" || result.confidence < 55) continue;
        const { data: row, error } = await supabase
          .from("incident_suggestions")
          .insert({
            source: "camera",
            camera_id: cam.camera_id,
            camera_name: cam.camera_name,
            lat: cam.lat,
            lng: cam.lng,
            state: cam.state ?? null,
            county: cam.county ?? null,
            image_url: cam.image_url,
            image_time: cam.image_time,
            label: result.label,
            confidence: result.confidence,
            reasoning: result.reasoning,
            status: "pending",
          })
          .select("id")
          .single();
        if (error) {
          // unique constraint = already analyzed this frame; skip silently
          if (!String(error.message).toLowerCase().includes("duplicate")) {
            errors.push(`${cam.camera_id}: ${error.message}`);
          }
        } else if (row) {
          created.push(row.id);
        }
      } catch (e: any) {
        errors.push(`${cam.camera_id}: ${e?.message ?? "failed"}`);
      }
    }
    return { created: created.length, analyzed, errors: errors.slice(0, 5) };
  });
