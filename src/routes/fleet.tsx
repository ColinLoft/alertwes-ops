import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Battery, Droplet, Plane, MapPin, Wrench, Clock, X, RadioTower } from "lucide-react";
import { fetchDrones, STATUS_META, type DroneRow, type DroneStatus } from "@/lib/drones";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet — Aegis Command" },
      { name: "description", content: "Live status of all Aegis fixed-wing wildfire response drones." },
    ],
  }),
  component: FleetPage,
  ssr: false,
});

const STATUS_ORDER: DroneStatus[] = [
  "inflight", "returning", "preflight", "ready", "charging", "maintenance", "offline",
];

function StatusPill({ status }: { status: DroneStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ borderColor: `${m.color}55`, color: m.color, background: `${m.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function BatteryBar({ pct }: { pct: number }) {
  const color = pct > 60 ? "#22c55e" : pct > 25 ? "#fbbf24" : "#ef4444";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <Battery className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums">{pct}%</span>
    </div>
  );
}

function FleetKPIs({ drones }: { drones: DroneRow[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { total: drones.length, ready: 0, inflight: 0, maint: 0 };
    drones.forEach((d) => {
      if (d.status === "ready") c.ready++;
      if (d.status === "inflight" || d.status === "returning" || d.status === "preflight") c.inflight++;
      if (d.status === "maintenance" || d.status === "offline") c.maint++;
    });
    return c;
  }, [drones]);
  const cells = [
    { label: "Fleet", value: counts.total, accent: "var(--primary)" },
    { label: "Ready", value: counts.ready, accent: "#22c55e" },
    { label: "Active", value: counts.inflight, accent: "#f4a261" },
    { label: "Down", value: counts.maint, accent: "#a78bfa" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-3 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{c.label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-bold tabular-nums" style={{ color: c.accent }}>{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DroneCard({ d, onSelect, selected }: { d: DroneRow; onSelect: () => void; selected: boolean }) {
  const m = STATUS_META[d.status];
  return (
    <button
      onClick={onSelect}
      className={`aw-panel text-left rounded-lg border bg-white/[0.03] p-3 backdrop-blur transition hover:bg-white/[0.06] ${selected ? "border-primary/60 ring-1 ring-primary/40" : "border-white/10"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
          <span className="font-mono font-semibold tracking-wide truncate">{d.tail_number}</span>
        </div>
        <StatusPill status={d.status} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground truncate">
        {d.airframe?.model ?? "—"} · {d.base?.code ?? "no base"}
      </div>
      <div className="mt-3 space-y-1.5">
        <BatteryBar pct={d.battery_pct} />
        <div className="flex items-center gap-2 text-[11px]">
          <Droplet className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono tabular-nums">{Number(d.retardant_l).toFixed(1)} L</span>
          <span className="text-muted-foreground">retardant</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono tabular-nums text-foreground/80">{Number(d.flight_hours).toFixed(1)} h</span>
          <span>total flight</span>
        </div>
      </div>
    </button>
  );
}

function DroneDrawer({ d, onClose }: { d: DroneRow; onClose: () => void }) {
  return (
    <aside className="aw-panel w-full sm:w-[360px] shrink-0 border-l border-white/10 bg-background/60 backdrop-blur p-4 overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Airframe</div>
          <div className="font-mono text-xl font-bold tracking-wide">{d.tail_number}</div>
          <div className="text-xs text-muted-foreground">{d.airframe?.model ?? "—"}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3"><StatusPill status={d.status} /></div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Battery</div>
          <div className="font-mono text-lg tabular-nums">{d.battery_pct}%</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Retardant</div>
          <div className="font-mono text-lg tabular-nums">{Number(d.retardant_l).toFixed(1)} L</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Range</div>
          <div className="font-mono text-lg tabular-nums">{d.airframe?.range_mi ?? "—"} mi</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Cruise</div>
          <div className="font-mono text-lg tabular-nums">{d.airframe?.cruise_speed_mph ?? "—"} mph</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Telemetry (placeholder)</div>
        <dl className="aw-popup-grid text-[11px]">
          <dt>Position</dt><dd className="font-mono">{d.last_lat?.toFixed(3) ?? "—"}, {d.last_lng?.toFixed(3) ?? "—"}</dd>
          <dt>Heading</dt><dd className="font-mono">{d.heading_deg != null ? Math.round(d.heading_deg) + "°" : "—"}</dd>
          <dt>Altitude</dt><dd className="font-mono">—</dd>
          <dt>Ground spd</dt><dd className="font-mono">—</dd>
          <dt>Link</dt><dd className="text-muted-foreground">No live datalink</dd>
        </dl>
      </div>

      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Base</div>
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold">{d.base?.name ?? "—"}</span>
          <span className="text-muted-foreground">{d.base?.code}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { label: "RTB", icon: RadioTower },
          { label: "Loiter", icon: Plane },
          { label: "Abort", icon: X },
        ].map((b) => (
          <button
            key={b.label}
            disabled
            title="Requires pilot datalink"
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-muted-foreground disabled:cursor-not-allowed"
          >
            <b.icon className="h-3.5 w-3.5 inline mr-1" />{b.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Maintenance</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" />
          Next service: {d.next_service_at ? new Date(d.next_service_at).toLocaleDateString() : "not scheduled"}
        </div>
      </div>
    </aside>
  );
}

function FleetPage() {
  const { data: drones = [], isLoading, refetch } = useQuery({
    queryKey: ["drones"],
    queryFn: fetchDrones,
    staleTime: 10_000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<DroneStatus | "all">("all");

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("drones-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "drones" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const filtered = useMemo(() => {
    const list = filter === "all" ? drones : drones.filter((d) => d.status === filter);
    return [...list].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.tail_number.localeCompare(b.tail_number),
    );
  }, [drones, filter]);

  const selected = drones.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Fleet</h1>
            <p className="text-xs text-muted-foreground">Live status of all Aegis airframes</p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(["all", ...STATUS_ORDER] as const).map((s) => {
              const active = filter === s;
              const label = s === "all" ? "All" : STATUS_META[s].label;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider transition ${active ? "border-primary/60 bg-primary/10 text-foreground" : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <FleetKPIs drones={drones} />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {isLoading && (
            <div className="col-span-full text-sm text-muted-foreground">Loading fleet…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
              No drones match this filter.
            </div>
          )}
          {filtered.map((d) => (
            <DroneCard
              key={d.id}
              d={d}
              selected={selectedId === d.id}
              onSelect={() => setSelectedId(d.id === selectedId ? null : d.id)}
            />
          ))}
        </div>
      </div>

      {selected && <DroneDrawer d={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
