import { X, MapPin, Compass, Clock, Camera as CamIcon, ExternalLink } from "lucide-react";
import type { Camera } from "@/lib/alertwest";

function fmtTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function relTime(s: string | null) {
  if (!s) return null;
  const d = new Date(s).getTime();
  if (!Number.isFinite(d)) return null;
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function CameraPanel({
  camera,
  onClose,
}: {
  camera: Camera | null;
  onClose: () => void;
}) {
  if (!camera) return null;
  const rel = relTime(camera.image.time);

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
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {camera.image.url ? (
            <img
              src={camera.image.url}
              alt={`Latest view from ${camera.name}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No image available
            </div>
          )}
          {rel && (
            <div className="absolute bottom-2 left-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur-sm">
              <Clock className="-mt-0.5 mr-1 inline h-3 w-3" />
              {rel}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          <Stat icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
            {[camera.site.county, camera.site.state].filter(Boolean).join(", ") || "—"}
          </Stat>
          <Stat icon={<Compass className="h-3.5 w-3.5" />} label="Pan / Tilt">
            {camera.position.pan ?? "—"}° / {camera.position.tilt ?? "—"}°
          </Stat>
          <Stat icon={<MapPin className="h-3.5 w-3.5" />} label="Coordinates">
            {Number(camera.site.latitude).toFixed(4)},{" "}
            {Number(camera.site.longitude).toFixed(4)}
          </Stat>
          <Stat icon={<CamIcon className="h-3.5 w-3.5" />} label="Hardware">
            {[camera.parameters["Brand.Brand"], camera.parameters["Brand.ProdNbr"]]
              .filter(Boolean)
              .join(" ") || "—"}
          </Stat>
        </div>

        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <span>Last image</span>
            <span className="text-foreground">{fmtTime(camera.image.time)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2">
            <span>Last position</span>
            <span className="text-foreground">{fmtTime(camera.position.time)}</span>
          </div>
        </div>

        {camera.image.url && (
          <div className="p-4 pt-0">
            <a
              href={camera.image.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Open full-size image <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}
