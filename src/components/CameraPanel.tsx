import { X, MapPin, Clock, Camera as CamIcon, ExternalLink, Signal } from "lucide-react";
import { useState } from "react";
import type { Camera } from "@/lib/alertwest";
import { getStatus, relTime } from "@/lib/alertwest";
import { ActivityTimeline } from "./ActivityTimeline";

import type { FrameRecord } from "@/hooks/useCameraHistory";

function fmtTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export function CameraPanel({
  camera,
  onClose,
  history,
}: {
  camera: Camera | null;
  onClose: () => void;
  history: FrameRecord[];
}) {
  const [previewOverride, setPreviewOverride] = useState<FrameRecord | null>(null);

  if (!camera) return null;
  const status = getStatus(camera);
  const liveFrame: FrameRecord | null = camera.image.url && camera.image.time
    ? { url: camera.image.url, time: camera.image.time, receivedAt: Date.now() }
    : null;
  // Reset override when switching cameras
  const display = previewOverride && history.some((f) => f.url === previewOverride.url)
    ? previewOverride
    : liveFrame;

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-[1000] flex w-full max-w-md flex-col border-l border-border bg-card/95 shadow-2xl backdrop-blur-md sm:top-0 md:max-w-lg">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <CamIcon className="h-3.5 w-3.5" />
            Camera #{camera.site.id}
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold">{camera.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{camera.source}</p>
          <StatusBadge camera={camera} />
        </div>
        <button
          onClick={() => {
            setPreviewOverride(null);
            onClose();
          }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {display?.url ? (
            <img
              src={display.url}
              alt={`View from ${camera.name}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No image available
            </div>
          )}
          {display && (
            <div className="absolute bottom-2 left-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur-sm">
              <Clock className="-mt-0.5 mr-1 inline h-3 w-3" />
              {relTime(display.time)}
            </div>
          )}
          {previewOverride && (
            <button
              onClick={() => setPreviewOverride(null)}
              className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-primary backdrop-blur-sm hover:bg-background"
            >
              Back to live
            </button>
          )}
        </div>

        <div className="space-y-3 p-4">
          <ActivityTimeline
            frames={history}
            activeUrl={display?.url ?? null}
            onSelect={(f) => setPreviewOverride(f)}
            onReturnLive={() => setPreviewOverride(null)}
            isLiveActive={!previewOverride}
          />

          <PTZDisplay camera={camera} />

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Location">
              {[camera.site.county, camera.site.state].filter(Boolean).join(", ") || "—"}
            </Stat>
            <Stat label="Coordinates">
              {Number(camera.site.latitude).toFixed(4)},{" "}
              {Number(camera.site.longitude).toFixed(4)}
            </Stat>
            <Stat label="Altitude">
              {camera.site.altitude ? `${camera.site.altitude} m` : "—"}
            </Stat>
            <Stat label="Hardware">
              {[camera.parameters["Brand.Brand"], camera.parameters["Brand.ProdNbr"]]
                .filter(Boolean)
                .join(" ") || "—"}
            </Stat>
          </div>

          <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <div className="flex justify-between gap-2">
              <span>Last image</span>
              <span className="text-foreground">{fmtTime(camera.image.time)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span>Last position</span>
              <span className="text-foreground">{fmtTime(camera.position.time)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span>Last parameters</span>
              <span className="text-foreground">{fmtTime(camera.parameters.time)}</span>
            </div>
          </div>

          {camera.image.url && (
            <a
              href={camera.image.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Open full-size image <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}

function StatusBadge({ camera }: { camera: Camera }) {
  const s = getStatus(camera);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider"
        style={{ borderColor: `${s.color}55`, color: s.color, background: `${s.color}15` }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
        />
        {s.label}
      </span>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <SignalBars level={s.signal} color={s.color} />
        <span>
          {s.ageMs !== null ? `updated ${relTime(new Date(Date.now() - s.ageMs))}` : "no signal data"}
        </span>
      </span>
    </div>
  );
}

function SignalBars({ level, color }: { level: 0 | 1 | 2 | 3 | 4; color: string }) {
  if (level === 0) return <Signal className="h-3 w-3 opacity-40" />;
  return (
    <span className="inline-flex items-end gap-[1.5px]">
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className="w-[2px] rounded-sm"
          style={{
            height: `${b * 2 + 2}px`,
            background: b <= level ? color : "var(--color-muted)",
            opacity: b <= level ? 1 : 0.4,
          }}
        />
      ))}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}
