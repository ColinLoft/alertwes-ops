import { Clock, Pause, Play, SkipBack } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { relTime } from "@/lib/alertwest";
import type { FrameRecord } from "@/hooks/useCameraHistory";

const PLAY_INTERVAL_MS = 1500;

export function ActivityTimeline({
  frames,
  onSelect,
  activeUrl,
  onReturnLive,
  isLiveActive,
}: {
  frames: FrameRecord[];
  onSelect: (f: FrameRecord) => void;
  activeUrl: string | null;
  onReturnLive: () => void;
  isLiveActive: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const idxRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Stop play if no frames or camera switched (frame list identity changes)
  useEffect(() => {
    setPlaying(false);
    idxRef.current = 0;
  }, [frames.length === 0 ? null : frames[frames.length - 1]?.url]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    // Frames are stored newest-first; play oldest→newest
    const ordered = [...frames].reverse();
    // Sync starting index to currently displayed frame if possible
    const cur = ordered.findIndex((f) => f.url === activeUrl);
    if (cur >= 0) idxRef.current = cur;

    const tick = () => {
      idxRef.current = (idxRef.current + 1) % ordered.length;
      onSelect(ordered[idxRef.current]);
    };
    const id = window.setInterval(tick, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
    // We intentionally don't depend on activeUrl to avoid resetting interval each tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, frames]);

  // Keyboard navigation across thumbnails
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-frame]") ?? [],
    );
    if (buttons.length === 0) return;
    const cur = buttons.findIndex((b) => b === document.activeElement);
    let next = cur;
    if (e.key === "ArrowRight") next = cur < 0 ? 0 : Math.min(buttons.length - 1, cur + 1);
    else if (e.key === "ArrowLeft") next = cur < 0 ? 0 : Math.max(0, cur - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    buttons[next]?.focus();
    buttons[next]?.click();
  };

  if (frames.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background/30 p-3 text-center text-[11px] text-muted-foreground">
        Waiting for new frames — history builds as the feed auto-refreshes.
      </div>
    );
  }

  return (
    <section aria-label="Recent activity timeline" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent Activity
        </h3>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] text-muted-foreground">
            {frames.length} frame{frames.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              onReturnLive();
            }}
            disabled={isLiveActive}
            aria-label="Return to live frame"
            className="rounded-md border border-border bg-card/60 p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <SkipBack className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={frames.length < 2}
            aria-label={playing ? "Pause timeline playback" : "Play timeline playback"}
            aria-pressed={playing}
            className="flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {playing ? (
              <>
                <Pause className="h-3 w-3" aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3 w-3" aria-hidden="true" /> Play
              </>
            )}
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Recorded frames, newest first"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex gap-2 overflow-x-auto pb-1 focus:outline-none"
      >
        {frames.map((f, i) => {
          const active = f.url === activeUrl;
          const ts = new Date(f.time).toLocaleString();
          return (
            <FrameThumb
              key={`${f.url}-${f.time}`}
              frame={f}
              index={i}
              active={active}
              label={`Frame ${frames.length - i} of ${frames.length}, captured ${ts}`}
              onSelect={() => {
                setPlaying(false);
                onSelect(f);
              }}
            />
          );
        })}
      </div>

      {playing && (
        <span className="sr-only" aria-live="polite">
          Playing timeline. Current frame captured {relTime(activeUrl ? frames.find((f) => f.url === activeUrl)?.time ?? null : null)}.
        </span>
      )}
    </section>
  );
}

function FrameThumb({
  frame,
  index,
  active,
  label,
  onSelect,
}: {
  frame: FrameRecord;
  index: number;
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrored(false);
    setAttempt((a) => a + 1);
  };

  return (
    <button
      type="button"
      data-frame
      role="option"
      aria-selected={active}
      aria-label={label}
      tabIndex={active || index === 0 ? 0 : -1}
      onClick={onSelect}
      className={`group relative shrink-0 overflow-hidden rounded-md border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-primary/60"
      }`}
      style={{ width: 96, height: 64 }}
    >
      {errored ? (
        <span
          onClick={retry}
          className="flex h-full w-full items-center justify-center bg-muted/40 text-[10px] text-muted-foreground hover:text-primary"
        >
          Retry
        </span>
      ) : (
        <img
          key={attempt}
          src={frame.url}
          alt=""
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-gradient-to-t from-black/85 to-transparent px-1 py-0.5 text-[9px] font-medium text-white"
      >
        <Clock className="h-2.5 w-2.5" />
        {relTime(frame.time)}
      </span>
    </button>
  );
}
