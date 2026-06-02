import { useEffect } from "react";

export type TimelineAction = "toggle" | "next" | "prev" | "live";

const EVT = "aw:timeline";

export function dispatchTimeline(action: TimelineAction) {
  window.dispatchEvent(new CustomEvent<TimelineAction>(EVT, { detail: action }));
}

export function useTimelineEvents(handler: (action: TimelineAction) => void) {
  useEffect(() => {
    const fn = (e: Event) => handler((e as CustomEvent<TimelineAction>).detail);
    window.addEventListener(EVT, fn);
    return () => window.removeEventListener(EVT, fn);
  }, [handler]);
}
