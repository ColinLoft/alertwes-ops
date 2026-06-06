import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/StubPage";

export const Route = createFileRoute("/incidents")({
  head: () => ({ meta: [{ title: "Incidents — Aegis Command" }] }),
  component: () => (
    <StubPage
      title="Incidents — Phase 2"
      blurb="Live wildfire feed (AlertWest cameras, NASA FIRMS, NWS Red Flag, FAA NOTAMs), triage queue, and incident workflow are next on the build list."
    />
  ),
  ssr: false,
});
