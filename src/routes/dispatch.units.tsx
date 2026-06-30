import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plane, Warehouse, Pencil } from "lucide-react";
import { fetchDrones, STATUS_META } from "@/lib/drones";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dispatch/units")({
  head: () => ({ meta: [{ title: "Units — Aegis Dispatch" }] }),
  component: UnitsPage,
  ssr: false,
});

interface Base { id: string; code: string; name: string; lat: number | null; lng: number | null }

async function fetchBases(): Promise<Base[]> {
  const { data, error } = await supabase.from("bases").select("id,code,name,lat,lng").order("code");
  if (error) throw error;
  return (data ?? []) as unknown as Base[];
}

function UnitsPage() {
  const { data: drones = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones, refetchInterval: 30_000 });
  const { data: bases = [] } = useQuery({ queryKey: ["bases"], queryFn: fetchBases });

  return (
    <div className="flex h-full flex-col overflow-auto p-4 gap-5">
      <section>
        <div className="mb-2 flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-primary" />
          <h2 className="text-[12px] font-bold uppercase tracking-[0.14em]">Launch Sites</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">({bases.length})</span>
          <Link to="/bases" className="ml-auto inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/25">
            <Pencil className="h-3 w-3" /> Manage / Add
          </Link>
        </div>
        {bases.length === 0 ? (
          <div className="rounded border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground">
            No launch sites yet. <Link to="/bases" className="text-primary hover:underline">Create one →</Link>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bases.map((b) => (
              <div key={b.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-base font-bold">{b.code}</div>
                  <Link to="/bases" className="text-[10px] uppercase tracking-wider text-primary hover:underline">Edit</Link>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground truncate">{b.name}</div>
                <div className="mt-1 text-[10.5px] font-mono text-muted-foreground">
                  {b.lat != null && b.lng != null ? `${b.lat.toFixed(3)}, ${b.lng.toFixed(3)}` : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Plane className="h-4 w-4 text-primary" />
          <h2 className="text-[12px] font-bold uppercase tracking-[0.14em]">Aircraft</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">({drones.length})</span>
          <Link to="/fleet" className="ml-auto inline-flex items-center gap-1 rounded border border-primary/50 bg-primary/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/25">
            <Pencil className="h-3 w-3" /> Manage / Add
          </Link>
        </div>
        {drones.length === 0 ? (
          <div className="rounded border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground">
            No aircraft yet. <Link to="/fleet" className="text-primary hover:underline">Add one →</Link>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {drones.map((d) => {
              const m = STATUS_META[d.status];
              return (
                <div key={d.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-base font-bold">{d.tail_number}</div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ borderColor: `${m.color}55`, color: m.color, background: `${m.color}14` }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />{m.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground truncate">
                    {d.airframe?.model ?? "—"} · Base {d.base?.code ?? "—"} · {d.battery_pct ?? 0}% bat
                  </div>
                  <Link to="/fleet" className="mt-3 inline-block text-[10px] uppercase tracking-wider text-primary hover:underline">Open in Fleet →</Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
