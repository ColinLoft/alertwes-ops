import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Warehouse, MapPin, Building2 } from "lucide-react";
import { fetchBases, fetchDrones, STATUS_META } from "@/lib/drones";
import { useMemo } from "react";

export const Route = createFileRoute("/bases")({
  head: () => ({ meta: [{ title: "Bases — Aegis Command" }] }),
  component: BasesPage,
  ssr: false,
});

function BasesPage() {
  const { data: bases = [] } = useQuery({ queryKey: ["bases"], queryFn: fetchBases });
  const { data: drones = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones });

  const byBase = useMemo(() => {
    const m = new Map<string, typeof drones>();
    drones.forEach((d) => {
      const k = d.base?.id ?? "_";
      const arr = m.get(k) ?? [];
      arr.push(d);
      m.set(k, arr);
    });
    return m;
  }, [drones]);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold tracking-wide">Bases</h1>
        <p className="text-xs text-muted-foreground">Drone launch sites and hangar capacity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {bases.map((b) => {
          const ds = byBase.get(b.id) ?? [];
          const ready = ds.filter((d) => d.status === "ready").length;
          return (
            <div key={b.id} className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{b.name}</span>
                    {b.is_hq && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">HQ</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {[b.city, b.state].filter(Boolean).join(", ") || "—"} · {b.code}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Capacity</div>
                  <div className="font-mono text-lg">{ds.length}/{b.hangar_capacity}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Ready</div>
                  <div className="font-mono text-base text-emerald-400">{ready}</div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Docked</div>
                  <div className="font-mono text-base">{ds.length}</div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Coords</div>
                  <div className="font-mono text-[10px]">{Number(b.lat).toFixed(2)}, {Number(b.lng).toFixed(2)}</div>
                </div>
              </div>

              <ul className="mt-3 space-y-1">
                {ds.map((d) => {
                  const m = STATUS_META[d.status];
                  return (
                    <li key={d.id} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-white/[0.04]">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
                        <span className="font-mono">{d.tail_number}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {bases.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
            <Building2 className="mx-auto h-6 w-6 mb-2 opacity-50" />
            No bases configured yet.
          </div>
        )}
      </div>
    </div>
  );
}
