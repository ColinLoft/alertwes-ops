import { createFileRoute } from "@tanstack/react-router";

const jsonHeaders = {
  "content-type": "application/json",
  "cache-control": "public, max-age=10",
};

function num(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function milesBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "ALERTWest-Viewer/1.0" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function ftToM(value: unknown) {
  return typeof value === "number" ? value * 0.3048 : null;
}

function ktToMs(value: unknown) {
  return typeof value === "number" ? value * 0.514444 : null;
}

function ftMinToMs(value: unknown) {
  return typeof value === "number" ? value * 0.00508 : null;
}

export const Route = createFileRoute("/api/planes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lamin = num(url.searchParams.get("lamin"));
        const lomin = num(url.searchParams.get("lomin"));
        const lamax = num(url.searchParams.get("lamax"));
        const lomax = num(url.searchParams.get("lomax"));
        if (lamin == null || lomin == null || lamax == null || lomax == null) {
          return new Response(JSON.stringify({ error: "bbox required" }), {
            status: 400,
            headers: jsonHeaders,
          });
        }

        const centerLat = (lamin + lamax) / 2;
        const centerLng = (lomin + lomax) / 2;
        const radiusMiles = Math.ceil(
          Math.min(500, Math.max(25, milesBetween(centerLat, centerLng, lamax, lomax))),
        );
        const adsb = new URL(
          `https://api.adsb.lol/v2/lat/${centerLat.toFixed(4)}/lon/${centerLng.toFixed(4)}/dist/${radiusMiles}`,
        );

        try {
          const res = await fetchWithTimeout(adsb.toString(), 7_000);
          if (res.ok) {
            const json = (await res.json()) as {
              ac?: Array<Record<string, unknown>>;
              now?: number;
            };
            const now = typeof json.now === "number" ? json.now / 1000 : Date.now() / 1000;
            const states = (json.ac ?? [])
              .filter((ac) => typeof ac.lat === "number" && typeof ac.lon === "number")
              .filter(
                (ac) =>
                  (ac.lat as number) >= lamin &&
                  (ac.lat as number) <= lamax &&
                  (ac.lon as number) >= lomin &&
                  (ac.lon as number) <= lomax,
              )
              .map((ac) => {
                const onGround = ac.alt_baro === "ground";
                const lastContact = Math.round(now - (typeof ac.seen === "number" ? ac.seen : 0));
                return [
                  String(ac.hex ?? ""),
                  String(ac.flight ?? ac.r ?? "").slice(0, 8),
                  String(ac.t ?? "ADS-B"),
                  lastContact,
                  lastContact,
                  ac.lon,
                  ac.lat,
                  ftToM(ac.alt_baro),
                  onGround,
                  ktToMs(ac.gs),
                  typeof ac.track === "number" ? ac.track : null,
                  ftMinToMs(ac.baro_rate),
                  null,
                  ftToM(ac.alt_geom),
                  typeof ac.squawk === "string" ? ac.squawk : null,
                  false,
                  0,
                ];
              });
            return new Response(JSON.stringify({ time: Math.round(now), states }), {
              status: 200,
              headers: jsonHeaders,
            });
          }
        } catch {
          // Fall through to OpenSky as a secondary source.
        }

        const upstream = new URL("https://opensky-network.org/api/states/all");
        upstream.searchParams.set("lamin", String(lamin));
        upstream.searchParams.set("lomin", String(lomin));
        upstream.searchParams.set("lamax", String(lamax));
        upstream.searchParams.set("lomax", String(lomax));
        try {
          const res = await fetchWithTimeout(upstream.toString(), 7_000);
          if (res.ok) {
            return new Response(await res.text(), { status: 200, headers: jsonHeaders });
          }
          return new Response(
            JSON.stringify({ time: Math.floor(Date.now() / 1000), states: [], fallback: true, upstream_status: res.status }),
            { status: 200, headers: jsonHeaders },
          );
        } catch (e) {
          console.warn("[api/planes] upstream failed:", String(e));
          return new Response(
            JSON.stringify({ time: Math.floor(Date.now() / 1000), states: [], fallback: true, error: String(e) }),
            { status: 200, headers: jsonHeaders },
          );
        }
      },
    },
  },
});
