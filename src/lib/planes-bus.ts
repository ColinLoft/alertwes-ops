import type { Plane } from "./opensky";

const EVENT = "aw:planes";

export function publishPlanes(planes: Plane[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Plane[]>(EVENT, { detail: planes }));
}

export function subscribePlanes(cb: (planes: Plane[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<Plane[]>).detail ?? []);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
