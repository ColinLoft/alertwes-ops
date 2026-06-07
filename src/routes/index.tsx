import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CameraList } from "@/components/CameraList";
import { fetchCameras } from "@/lib/alertwest";
import { fetchDetectionArea, isInDetectionArea } from "@/lib/area";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cameras — Aegis Command" },
      { name: "description", content: "ALERTWest wildfire detection camera roster." },
    ],
  }),
  component: CamerasPage,
  ssr: false,
});

function CamerasPage() {
  const { data: cameras = [] } = useQuery({
    queryKey: ["aw-cameras"],
    queryFn: fetchCameras,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const { data: area } = useQuery({ queryKey: ["detection_area"], queryFn: fetchDetectionArea });
  const [scope, setScope] = useState<"area" | "all">("area");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (scope === "all" || !area) return cameras;
    return cameras.filter((c) => {
      const lat = Number(c.site.latitude), lng = Number(c.site.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return false;
      return isInDetectionArea({ lat, lng, state: c.site.state, county: c.site.county }, area);
    });
  }, [cameras, area, scope]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3 glass-subtle">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Camera Roster</div>
          <div className="text-base font-semibold">ALERTWest Network</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setScope("area")}
            className={`rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${scope === "area" ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
            In Detection Area
          </button>
          <button onClick={() => setScope("all")}
            className={`rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${scope === "all" ? "border-primary/50 bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>
            All
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <CameraList cameras={visible} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}
