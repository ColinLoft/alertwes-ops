import { useEffect, useState } from "react";

export interface RadiusFilter {
  address: string;
  lat: number;
  lng: number;
  /** Stored & interpreted as MILES (legacy field name). */
  km: number;
}

export type Basemap =
  | "darkTerrain"
  | "voyager"
  | "streets"
  | "satellite"
  | "terrain"
  | "dark"
  | "topo";

export interface Settings {
  // General
  refreshSeconds: number;
  playIntervalMs: number;
  showViewLines: boolean;
  showMarkerPulse: boolean;
  autoOpenNearest: boolean;
  defaultZoom: number;
  basemap: Basemap;
  showLabels: boolean;
  showPlanes: boolean;
  planesRefreshSeconds: number;

  // Camera filters
  states: string[];
  counties: string[];
  radius: RadiusFilter | null;

  // Plane filters (independent of camera filters)
  planesRadius: RadiusFilter | null;
  planesStates: string[];
  planesCounties: string[];

  // Branding
  logoDataUrl: string | null;
  brandName: string;
  primaryColor: string; // any CSS color (hex preferred)
  accentColor: string;
  backgroundColor: string; // CSS color for --background (oklch or hex)
}

export const DEFAULT_SETTINGS: Settings = {
  refreshSeconds: 60,
  playIntervalMs: 1500,
  showViewLines: true,
  showMarkerPulse: true,
  autoOpenNearest: false,
  defaultZoom: 6,
  basemap: "darkTerrain",
  showLabels: true,
  showPlanes: true,
  planesRefreshSeconds: 20,
  states: ["CA"],
  counties: [],
  radius: null,
  planesRadius: null,
  planesStates: [],
  planesCounties: [],
  logoDataUrl: null,
  brandName: "ALERTWest",
  primaryColor: "#f4a261",
  accentColor: "#f4a261",
  backgroundColor: "oklch(0.14 0.02 240)",
};

const KEY = "aw.settings.v1";
const DARK_TERRAIN_MIGRATION_KEY = "aw.settings.darkTerrainDefault.v1";

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!window.localStorage.getItem(DARK_TERRAIN_MIGRATION_KEY)) {
      merged.basemap = "darkTerrain";
      window.localStorage.setItem(DARK_TERRAIN_MIGRATION_KEY, "1");
      window.localStorage.setItem(KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function write(s: Settings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("aw:settings", { detail: s }));
  } catch {
    // ignore quota errors
  }
}

export function useSettings(): [Settings, (s: Settings | ((p: Settings) => Settings)) => void] {
  const [state, setState] = useState<Settings>(DEFAULT_SETTINGS);

  // Load on mount + subscribe to cross-tab/cross-component updates
  useEffect(() => {
    setState(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(read());
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<Settings>).detail;
      if (detail) setState(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("aw:settings", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("aw:settings", onCustom);
    };
  }, []);

  const update = (next: Settings | ((p: Settings) => Settings)) => {
    setState((prev) => {
      const value = typeof next === "function" ? (next as (p: Settings) => Settings)(prev) : next;
      write(value);
      return value;
    });
  };

  return [state, update];
}

/* ---------- URL persistence ----------
 * Encodes the shareable view-state into URL search params so links
 * can be sent to others and refreshes preserve the same map setup.
 */

const URL_KEYS = ["basemap", "labels", "planes", "pradius", "radius"] as const;

function encodeRadius(r: RadiusFilter | null): string | null {
  if (!r) return null;
  return `${r.lat.toFixed(5)},${r.lng.toFixed(5)},${r.km},${encodeURIComponent(r.address)}`;
}

function decodeRadius(v: string | null): RadiusFilter | null {
  if (!v) return null;
  const parts = v.split(",");
  if (parts.length < 3) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  const mi = Number(parts[2]);
  if (![lat, lng, mi].every(Number.isFinite)) return null;
  const address = parts.slice(3).join(",");
  return { lat, lng, km: mi, address: address ? decodeURIComponent(address) : "Shared location" };
}

export function settingsToUrlParams(s: Settings): URLSearchParams {
  const p = new URLSearchParams();
  p.set("basemap", s.basemap);
  p.set("labels", s.showLabels ? "1" : "0");
  p.set("planes", s.showPlanes ? "1" : "0");
  const pr = encodeRadius(s.planesRadius);
  if (pr) p.set("pradius", pr);
  const r = encodeRadius(s.radius);
  if (r) p.set("radius", r);
  return p;
}

export function applyUrlParamsToSettings(s: Settings, params: URLSearchParams): Settings {
  const next = { ...s };
  const bm = params.get("basemap");
  if (bm && bm in DEFAULT_BASEMAPS) next.basemap = bm as Basemap;
  const labels = params.get("labels");
  if (labels === "0" || labels === "1") next.showLabels = labels === "1";
  const planes = params.get("planes");
  if (planes === "0" || planes === "1") next.showPlanes = planes === "1";
  if (params.has("pradius")) next.planesRadius = decodeRadius(params.get("pradius"));
  if (params.has("radius")) next.radius = decodeRadius(params.get("radius"));
  return next;
}

// Whitelist of known basemap ids — kept in sync with Basemap union.
const DEFAULT_BASEMAPS: Record<Basemap, true> = {
  darkTerrain: true,
  voyager: true,
  streets: true,
  satellite: true,
  terrain: true,
  dark: true,
  topo: true,
};

/** Two-way sync settings ↔ URL search params on the current page. */
export function useSettingsUrlSync(
  settings: Settings,
  setSettings: (s: Settings | ((p: Settings) => Settings)) => void,
) {
  // Read URL once on mount and merge into settings (URL wins for shareable keys).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (![...URL_KEYS].some((k) => params.has(k))) return;
    setSettings((prev) => applyUrlParamsToSettings(prev, params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write current settings into URL whenever shareable fields change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const incoming = settingsToUrlParams(settings);
    const current = new URLSearchParams(window.location.search);
    // Drop our keys, then merge updated values back in.
    URL_KEYS.forEach((k) => current.delete(k));
    incoming.forEach((v, k) => current.set(k, v));
    const qs = current.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [
    settings.basemap,
    settings.showLabels,
    settings.showPlanes,
    settings.planesRadius,
    settings.radius,
  ]);
}
