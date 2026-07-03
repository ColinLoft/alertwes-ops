import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SelectionKind = "aircraft" | "camera" | "hotspot" | "incident" | "plane" | "base" | null;
export interface Selection {
  kind: SelectionKind;
  id: string | null;
  // Optional payload we can stash for hotspots/planes that aren't in DB
  payload?: any;
}

export type DrawerKey = null | "incidents" | "cameras" | "units" | "feed";

export interface FlyTarget { lat: number; lng: number; zoom: number; key: number }

interface MissionState {
  selection: Selection;
  select: (s: Selection) => void;
  clear: () => void;

  drawer: DrawerKey;
  setDrawer: (d: DrawerKey) => void;
  toggleDrawer: (d: Exclude<DrawerKey, null>) => void;

  flyTarget: FlyTarget | null;
  flyTo: (lat: number, lng: number, zoom?: number) => void;

  feedOpen: boolean;
  setFeedOpen: (v: boolean) => void;
}

export const useMission = create<MissionState>((set, get) => ({
  selection: { kind: null, id: null },
  select: (s) => set({ selection: s }),
  clear: () => set({ selection: { kind: null, id: null } }),

  drawer: null,
  setDrawer: (d) => set({ drawer: d }),
  toggleDrawer: (d) => set({ drawer: get().drawer === d ? null : d }),

  flyTarget: null,
  flyTo: (lat, lng, zoom = 12) => set({ flyTarget: { lat, lng, zoom, key: Date.now() } }),

  feedOpen: true,
  setFeedOpen: (v) => set({ feedOpen: v }),
}));

// ---- Layer visibility (persisted) ----
export interface LayerState {
  aircraft: boolean;
  cameras: boolean;
  incidents: boolean;
  firms: boolean;
  redflag: boolean;
  detectionArea: boolean;
  bases: boolean;
}

interface LayerStore {
  layers: LayerState;
  toggle: (k: keyof LayerState) => void;
  set: (k: keyof LayerState, v: boolean) => void;
}

export const useLayers = create<LayerStore>()(
  persist(
    (set, get) => ({
      layers: {
        aircraft: true,
        cameras: true,
        incidents: true,
        firms: true,
        redflag: true,
        detectionArea: true,
        bases: true,
      },
      toggle: (k) => set({ layers: { ...get().layers, [k]: !get().layers[k] } }),
      set: (k, v) => set({ layers: { ...get().layers, [k]: v } }),
    }),
    { name: "aegis.layers.v1" },
  ),
);
