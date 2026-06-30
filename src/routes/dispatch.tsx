import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { fetchIncidents, PRIORITY_META, STATUS_META, type IncidentRow } from "@/lib/incidents";

export const Route = createFileRoute("/dispatch")({
  head: () => ({ meta: [{ title: "Active Calls — Aegis Dispatch" }] }),
  component: DispatchPage,
  ssr: false,
});

function DispatchPage() {
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 15_000 });
  const active = incidents.filter((i) => !["closed", "false_positive"].includes(i.status));
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/10">
        <Radio className="h-4 w-4 text-primary" />
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/90">Active Calls</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">({active.length})</span>
        <Link to="/dispatch/units" className="ml-auto text-[10px] uppercase tracking-wider text-primary hover:underline">Manage units →</Link>
      </div>
      {active.length === 0 ? (
        <div className="px-3 py-10 text-center text-sm text-muted-foreground">No active calls.</div>
      ) : (
        <table className="cad-table">
          <thead>
            <tr>
              <th>Source</th><th>Call #</th><th>Pri</th><th>Type</th><th>Location</th><th>Status</th><th>Assigned</th><th></th>
            </tr>
          </thead>
          <tbody>
            {active.map((i) => (
              <CallRow key={i.id} i={i} onOpen={() => navigate({ to: "/incidents" })} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CallRow({ i, onOpen }: { i: IncidentRow; onOpen: () => void }) {
  const pri = PRIORITY_META[i.priority];
  const status = STATUS_META[i.status];
  return (
    <tr onClick={onOpen} className="cursor-pointer">
      <td><span className="rounded px-1.5 py-0.5 text-[9.5px] font-black tracking-wider" style={{ background: "oklch(0.55 0.22 25)", color: "white" }}>{i.source.toUpperCase()}</span></td>
      <td className="font-mono font-bold text-primary">{i.id.slice(0, 8).toUpperCase()}</td>
      <td><span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ background: `${pri.color}22`, color: pri.color }}>{pri.label}</span></td>
      <td>{i.title.slice(0, 60)}</td>
      <td className="text-muted-foreground font-mono text-[10.5px]">{Number(i.lat).toFixed(3)}, {Number(i.lng).toFixed(3)}</td>
      <td><span className="text-[11px] font-semibold" style={{ color: status.color }}>{status.label}</span></td>
      <td>{i.assigned_drone_id ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">ASSIGNED</span> : <span className="text-muted-foreground">—</span>}</td>
      <td><span className="rounded border border-primary/50 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Details →</span></td>
    </tr>
  );
}
