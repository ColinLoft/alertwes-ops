import type { Plane } from "./opensky";

const EVENT = "aw:planes";

function sig(planes: Plane[]): string {
  // Cheap stable signature so duplicate publishes don't trigger re-renders.
  return `${planes.length}|${planes[0]?.icao24 ?? ""}|${planes[planes.length - 1]?.icao24 ?? ""}|${planes[0]?.lastContact ?? 0}`;
}

let lastSig = "";
let lastPlanes: Plane[] = [];

export function publishPlanes(planes: Plane[]) {
  if (typeof window === "undefined") return;
  const s = sig(planes);
  if (s === lastSig) return;
  lastSig = s;
  lastPlanes = planes;
  window.dispatchEvent(new CustomEvent<Plane[]>(EVENT, { detail: planes }));
}

export function subscribePlanes(cb: (planes: Plane[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (lastPlanes.length) cb(lastPlanes);
  const handler = (e: Event) => cb((e as CustomEvent<Plane[]>).detail ?? []);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
