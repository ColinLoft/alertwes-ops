import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Info, Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Camera } from "@/lib/alertwest";

/**
 * PTZ control panel. The public ALERTWest API is read-only, so commands
 * cannot reach the cameras. We render a fully interactive control surface
 * with a live read-out of the camera's current pan/tilt/zoom and a clear
 * notice that movement requests are not transmitted.
 */
export function PTZDisplay({ camera }: { camera: Camera }) {
  const pan = Number(camera.position.pan ?? NaN);
  const tilt = Number(camera.position.tilt ?? NaN);
  const zoom = Number(camera.position.zoom ?? NaN);

  const [target, setTarget] = useState<{ pan: number; tilt: number; zoom: number }>({
    pan: Number.isFinite(pan) ? pan : 0,
    tilt: Number.isFinite(tilt) ? tilt : 0,
    zoom: Number.isFinite(zoom) ? zoom : 1,
  });
  const [notice, setNotice] = useState(false);

  const nudge = (dp: number, dt: number, dz: number) => {
    setTarget((t) => ({
      pan: ((t.pan + dp) % 360 + 360) % 360,
      tilt: Math.max(-90, Math.min(90, t.tilt + dt)),
      zoom: Math.max(1, Math.min(40, +(t.zoom + dz).toFixed(1))),
    }));
    setNotice(true);
  };

  const reset = () => {
    setTarget({
      pan: Number.isFinite(pan) ? pan : 0,
      tilt: Number.isFinite(tilt) ? tilt : 0,
      zoom: Number.isFinite(zoom) ? zoom : 1,
    });
    setNotice(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          PTZ Control
        </h3>
        <button
          onClick={reset}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Sync
        </button>
      </div>

      <div className="grid grid-cols-[auto,1fr] gap-3">
        {/* Compass */}
        <Compass pan={target.pan} livePan={pan} />

        {/* Controls */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1">
            <span />
            <PadBtn onClick={() => nudge(0, 5, 0)} aria-label="Tilt up">
              <ArrowUp className="h-3.5 w-3.5" />
            </PadBtn>
            <span />
            <PadBtn onClick={() => nudge(-5, 0, 0)} aria-label="Pan left">
              <ArrowLeft className="h-3.5 w-3.5" />
            </PadBtn>
            <div className="flex items-center justify-center rounded-md border border-border bg-card/50 text-[9px] uppercase tracking-widest text-muted-foreground">
              PTZ
            </div>
            <PadBtn onClick={() => nudge(5, 0, 0)} aria-label="Pan right">
              <ArrowRight className="h-3.5 w-3.5" />
            </PadBtn>
            <span />
            <PadBtn onClick={() => nudge(0, -5, 0)} aria-label="Tilt down">
              <ArrowDown className="h-3.5 w-3.5" />
            </PadBtn>
            <span />
          </div>

          <div className="flex items-center gap-1.5">
            <PadBtn onClick={() => nudge(0, 0, -1)} aria-label="Zoom out">
              <Minus className="h-3.5 w-3.5" />
            </PadBtn>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-primary"
                style={{ width: `${Math.min(100, (target.zoom / 40) * 100)}%` }}
              />
            </div>
            <PadBtn onClick={() => nudge(0, 0, 1)} aria-label="Zoom in">
              <Plus className="h-3.5 w-3.5" />
            </PadBtn>
            <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
              {target.zoom.toFixed(1)}×
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Readout label="Pan" value={fmtDeg(target.pan)} live={fmtDeg(pan)} />
        <Readout label="Tilt" value={fmtDeg(target.tilt)} live={fmtDeg(tilt)} />
        <Readout label="Zoom" value={`${target.zoom.toFixed(1)}×`} live={Number.isFinite(zoom) ? `${zoom.toFixed(1)}×` : "—"} />
      </div>

      {notice && (
        <div className="flex items-start gap-1.5 rounded-md border border-border bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          <span>
            ALERTWest's public API is read-only — PTZ commands are not transmitted. Live
            position updates each refresh.
          </span>
        </div>
      )}
    </div>
  );
}

function fmtDeg(n: number) {
  return Number.isFinite(n) ? `${n.toFixed(0)}°` : "—";
}

function PadBtn({
  children,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      {...rest}
      className="flex h-8 items-center justify-center rounded-md border border-border bg-card/60 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95"
    >
      {children}
    </button>
  );
}

function Readout({ label, value, live }: { label: string; value: string; live: string }) {
  const same = value === live;
  return (
    <div className="rounded-md border border-border bg-card/40 px-2 py-1">
      <div className="text-[9px]">{label}</div>
      <div className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{value}</div>
      {!same && (
        <div className="text-[9px] normal-case tracking-normal text-muted-foreground">
          live {live}
        </div>
      )}
    </div>
  );
}

function Compass({ pan, livePan }: { pan: number; livePan: number }) {
  return (
    <div className="relative h-24 w-24 shrink-0 rounded-full border border-border bg-card/60">
      {/* cardinal marks */}
      {["N", "E", "S", "W"].map((d, i) => (
        <span
          key={d}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground"
          style={{
            transform: `translate(-50%,-50%) rotate(${i * 90}deg) translateY(-38px) rotate(-${i * 90}deg)`,
          }}
        >
          {d}
        </span>
      ))}
      {/* live pan indicator (dim) */}
      {Number.isFinite(livePan) && (
        <div
          className="absolute left-1/2 top-1/2 h-9 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full bg-muted-foreground/40"
          style={{ transform: `translate(-50%,-100%) rotate(${livePan}deg)` }}
        />
      )}
      {/* target pan indicator */}
      <div
        className="absolute left-1/2 top-1/2 h-10 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full bg-primary shadow-[0_0_8px_var(--color-primary)] transition-transform"
        style={{ transform: `translate(-50%,-100%) rotate(${pan}deg)` }}
      />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
    </div>
  );
}
