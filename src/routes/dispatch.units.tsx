import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchDrones, STATUS_META } from "@/lib/drones";
import { Plane } from "lucide-react";

export const Route = createFileRoute("/dispatch/units")({
  head: () => ({ meta: [{ title: "Units — Aegis Dispatch" }] }),
  component: UnitsPage,
  ssr: false,
});

function UnitsPage() {
  const { data: drones = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones, refetchInterval: 15_000 });
  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <Plane className="h-5 w-5 text-primary" />
        <h1 className="text-[14px] font-bold uppercase tracking-[0.14em]">Full Unit Roster ({drones.length})</h1>
      </div>
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
              <div className="mt-2 text-[11px] text-muted-foreground">
                {d.airframe?.model ?? "—"} · Base {d.base?.code ?? "—"} · {d.battery_pct ?? 0}% bat
              </div>
              <Link to="/fleet" className="mt-3 inline-block text-[11px] font-semibold uppercase tracking-wider text-primary hover:underline">Open in Fleet →</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
