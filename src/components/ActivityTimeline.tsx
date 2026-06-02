import { Clock } from "lucide-react";
import { relTime } from "@/lib/alertwest";
import type { FrameRecord } from "@/hooks/useCameraHistory";

export function ActivityTimeline({
  frames,
  onSelect,
  activeUrl,
}: {
  frames: FrameRecord[];
  onSelect: (f: FrameRecord) => void;
  activeUrl: string | null;
}) {
  if (frames.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background/30 p-3 text-center text-[11px] text-muted-foreground">
        Waiting for new frames to appear — history will build up as the feed auto-refreshes.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent Activity
        </h3>
        <span className="text-[10px] text-muted-foreground">{frames.length} frame{frames.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {frames.map((f) => {
          const active = f.url === activeUrl;
          return (
            <button
              key={`${f.url}-${f.time}`}
              onClick={() => onSelect(f)}
              className={`group relative shrink-0 overflow-hidden rounded-md border transition-all ${
                active
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-primary/60"
              }`}
              style={{ width: 96, height: 64 }}
            >
              <img
                src={f.url}
                alt={`Frame at ${f.time}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-gradient-to-t from-black/85 to-transparent px-1 py-0.5 text-[9px] font-medium text-white">
                <Clock className="h-2.5 w-2.5" />
                {relTime(f.time)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
