import { useEffect, useRef, useState } from "react";
import type { Camera } from "@/lib/alertwest";

export interface FrameRecord {
  url: string;
  time: string; // ISO
  receivedAt: number;
}

const MAX_FRAMES = 12;

/**
 * Tracks a rolling history of distinct image frames per camera, populated
 * each time the cameras query refetches. Pure client-side — no extra API.
 */
export function useCameraHistory(cameras: Camera[] | undefined, updatedAt: number) {
  const [history, setHistory] = useState<Record<string, FrameRecord[]>>({});
  const lastUpdate = useRef(0);

  useEffect(() => {
    if (!cameras || updatedAt === lastUpdate.current) return;
    lastUpdate.current = updatedAt;

    setHistory((prev) => {
      const next: Record<string, FrameRecord[]> = { ...prev };
      for (const c of cameras) {
        const url = c.image.url;
        const time = c.image.time;
        if (!url || !time) continue;
        const arr = next[c.site.id] ?? [];
        const head = arr[0];
        if (head && head.url === url && head.time === time) continue;
        next[c.site.id] = [{ url, time, receivedAt: updatedAt }, ...arr].slice(0, MAX_FRAMES);
      }
      return next;
    });
  }, [cameras, updatedAt]);

  return history;
}
