import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

function stub(title: string, blurb: string) {
  return function StubPage() {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="aw-panel max-w-md rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur p-6 text-center">
          <Construction className="mx-auto h-7 w-7 text-primary mb-3" />
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>
        </div>
      </div>
    );
  };
}

export const IncidentsRoute = stub(
  "Incidents — coming in Phase 2",
  "Live wildfire feed (AlertWest cameras, NASA FIRMS, NWS Red Flag, FAA NOTAMs), triage queue, and incident workflow are next.",
);
export const DisasterRoute = stub(
  "Disaster Response — coming in Phase 4",
  "USGS quakes and NWS alerts will land here for non-fire ISR missions.",
);
export const MaintenanceRoute = stub(
  "Maintenance log — coming in Phase 4",
  "Per-airframe scheduled / unscheduled maintenance entries.",
);
export const PersonnelRoute = stub(
  "Personnel — coming in Phase 4",
  "Crew roster, shifts, and on-call schedule.",
);

export const Route = createFileRoute("/_stubs")({
  component: () => null,
  ssr: false,
});
