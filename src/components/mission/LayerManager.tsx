import { Layers, Plane, Camera, Flame, AlertTriangle, ShieldAlert, Compass, Warehouse } from "lucide-react";
import { useState } from "react";
import { useLayers, type LayerState } from "@/lib/mission-store";

const ITEMS: { key: keyof LayerState; label: string; icon: any; color: string }[] = [
  { key: "aircraft",      label: "Aircraft",         icon: Plane,        color: "#facc15" },
  { key: "cameras",       label: "Cameras",          icon: Camera,       color: "#22d3ee" },
  { key: "incidents",     label: "Incidents",        icon: AlertTriangle, color: "#ef4444" },
  { key: "firms",         label: "FIRMS Hotspots",   icon: Flame,        color: "#f97316" },
  { key: "redflag",       label: "Red Flag Warnings", icon: ShieldAlert, color: "#f59e0b" },
  { key: "bases",         label: "Bases",            icon: Warehouse,    color: "#a78bfa" },
  { key: "detectionArea", label: "Detection Area",   icon: Compass,      color: "#64748b" },
];

export function LayerManager() {
  const [open, setOpen] = useState(true);
  const layers = useLayers((s) => s.layers);
  const toggle = useLayers((s) => s.toggle);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-3 top-3 z-[1050] flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/70 text-foreground shadow-xl backdrop-blur-xl hover:bg-black/85"
        title="Show layers"
      >
        <Layers className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="absolute right-3 top-3 z-[1050] w-56 rounded-xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Layers className="h-3.5 w-3.5 text-primary" />
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Layers</div>
        <button onClick={() => setOpen(false)} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">Hide</button>
      </div>
      <div className="p-1.5">
        {ITEMS.map(({ key, label, icon: Icon, color }) => {
          const on = layers[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-white/[0.06]"
            >
              <span
                className={`flex h-4 w-7 items-center rounded-full border transition-colors ${
                  on ? "border-white/20 bg-white/15" : "border-white/10 bg-black/40"
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full transition-transform"
                  style={{
                    background: on ? color : "#666",
                    transform: `translateX(${on ? 12 : 2}px)`,
                    boxShadow: on ? `0 0 8px ${color}` : undefined,
                  }}
                />
              </span>
              <Icon className="h-3.5 w-3.5" style={{ color: on ? color : "#94a3b8" }} />
              <span className={on ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
