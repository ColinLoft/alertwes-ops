import { useEffect, useState } from "react";

export interface RadiusFilter {
  address: string;
  lat: number;
  lng: number;
  km: number;
}

export type Basemap = "voyager" | "streets" | "satellite" | "terrain" | "dark" | "topo";

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

  // Camera filters
  states: string[];
  counties: string[];
  radius: RadiusFilter | null;
}

export const DEFAULT_SETTINGS: Settings = {
  refreshSeconds: 60,
  playIntervalMs: 1500,
  showViewLines: true,
  showMarkerPulse: true,
  autoOpenNearest: false,
  defaultZoom: 6,
  basemap: "voyager",
  showLabels: true,
  states: ["CA"],
  counties: [],
  radius: null,
};

const KEY = "aw.settings.v1";

function read(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
