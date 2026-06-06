import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/StubPage";

export const Route = createFileRoute("/ops/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Aegis Command" }] }),
  component: () => (
    <StubPage
      title="Maintenance Log — Phase 4"
      blurb="Scheduled vs unscheduled maintenance entries per airframe, with quick log-entry forms."
    />
  ),
  ssr: false,
});
