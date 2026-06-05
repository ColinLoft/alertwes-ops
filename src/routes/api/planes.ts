import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/planes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lamin = url.searchParams.get("lamin");
        const lomin = url.searchParams.get("lomin");
        const lamax = url.searchParams.get("lamax");
        const lomax = url.searchParams.get("lomax");
        if (!lamin || !lomin || !lamax || !lomax) {
          return new Response(JSON.stringify({ error: "bbox required" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const upstream = new URL("https://opensky-network.org/api/states/all");
        upstream.searchParams.set("lamin", lamin);
        upstream.searchParams.set("lomin", lomin);
        upstream.searchParams.set("lamax", lamax);
        upstream.searchParams.set("lomax", lomax);
        try {
          const res = await fetch(upstream.toString(), {
            headers: { "user-agent": "ALERTWest-Viewer/1.0" },
          });
          const body = await res.text();
          return new Response(body, {
            status: res.status,
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=10",
            },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "upstream_failed", message: String(e) }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
