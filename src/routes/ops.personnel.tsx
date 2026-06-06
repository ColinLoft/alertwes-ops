import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/StubPage";

export const Route = createFileRoute("/ops/personnel")({
  head: () => ({ meta: [{ title: "Personnel — Aegis Command" }] }),
  component: () => (
    <StubPage
      title="Personnel — Phase 4"
      blurb="Crew roster, shifts, and on-call schedule placeholder. Admins manage role assignments from the Admin page."
    />
  ),
  ssr: false,
});
