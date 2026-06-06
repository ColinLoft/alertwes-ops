import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/StubPage";

export const Route = createFileRoute("/disaster")({
  head: () => ({ meta: [{ title: "Disaster Response — Aegis Command" }] }),
  component: () => (
    <StubPage
      title="Disaster Response — Phase 4"
      blurb="USGS earthquakes and active NWS alerts overlaid on the map, with an ISR-only deployment workflow that reuses the dispatch engine."
    />
  ),
  ssr: false,
});
