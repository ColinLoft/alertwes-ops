import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Radio } from "lucide-react";
import { fetchIncidents, PRIORITY_META, STATUS_META, type IncidentRow } from "@/lib/incidents";
import { fetchDrones, STATUS_META as DRONE_STATUS } from "@/lib/drones";

export const Route = createFileRoute("/dispatch")({
  head: () => ({ meta: [{ title: "Active Calls — Aegis Dispatch" }] }),
  component: DispatchPage,
  ssr: false,
});

function DispatchPage() {
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 15_000 });
  const { data: drones = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones, refetchInterval: 15_000 });

  const active = incidents.filter((i) => !["closed", "false_positive"].includes(i.status));
  const signedIn = drones.filter((d) => d.status !== "offline");

  return (
    <div className="flex h-full flex-col overflow-auto">
      <Section title={`All Active Calls`} count={active.length} icon={Radio}>
        {active.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No active calls.</div>
        ) : (
          <table className="cad-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Call #</th>
                <th>Pri</th>
                <th>Type</th>
                <th>Location</th>
                <th>Units</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {active.map((i) => <CallRow key={i.id} i={i} />)}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Signed-In Units" count={signedIn.length}>
        {signedIn.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No units signed in.</div>
        ) : (
          <table className="cad-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Airframe</th>
                <th>Status</th>
                <th>Battery</th>
                <th>Assigned Call</th>
                <th>Base</th>
              </tr>
            </thead>
            <tbody>
              {signedIn.map((d) => {
                const assigned = incidents.find((i) => i.assigned_drone_id === d.id);
                const meta = DRONE_STATUS[d.status];
                return (
                  <tr key={d.id}>
                    <td className="font-bold">{d.tail_number}</td>
                    <td>{d.airframe?.model ?? "—"}</td>
                    <td><span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}14` }}>{meta.label}</span></td>
                    <td>{d.battery_pct ?? "—"}%</td>
                    <td>{assigned ? <Link to="/incidents" className="font-bold text-primary hover:underline">{assigned.title.slice(0, 40)}</Link> : <span className="text-muted-foreground">—</span>}</td>
                    <td>{d.base?.code ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Cross-Agency Status">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-3">
          {[
            { code: "AEGIS", label: "Aegis CAD", status: "ON DUTY", calls: active.length, color: "oklch(0.72 0.18 45)" },
            { code: "ALERTWEST", label: "ALERTWest Camera Net", status: "STREAMING", calls: "—", color: "oklch(0.68 0.18 240)" },
            { code: "FIRMS", label: "NASA FIRMS", status: "POLLING", calls: "—", color: "oklch(0.62 0.20 30)" },
            { code: "NWS", label: "Nat'l Weather Svc", status: "STREAMING", calls: "—", color: "oklch(0.68 0.15 200)" },
          ].map((a) => (
            <div key={a.code} className="flex items-center justify-between rounded border border-white/10 bg-white/[0.03] px-3 py-2">
              <div>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-black tracking-wider" style={{ background: a.color, color: "black" }}>{a.code}</span>
                <div className="mt-1 text-[11px] text-muted-foreground">{a.label}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-emerald-300">{a.status}</div>
                <div className="text-[11px] tabular-nums text-muted-foreground">{a.calls}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, count, icon: Icon, children }: { title: string; count?: number; icon?: typeof Radio; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/10">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02]">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/90">{title}</h2>
        {count != null && <span className="text-[11px] tabular-nums text-muted-foreground">({count})</span>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function CallRow({ i }: { i: IncidentRow }) {
  const pri = PRIORITY_META[i.priority];
  const status = STATUS_META[i.status];
  return (
    <tr>
      <td><span className="rounded px-1.5 py-0.5 text-[9.5px] font-black tracking-wider" style={{ background: "oklch(0.55 0.22 25)", color: "white" }}>{i.source.toUpperCase()}</span></td>
      <td className="font-mono font-bold text-primary">{i.id.slice(0, 8).toUpperCase()}</td>
      <td><span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ background: `${pri.color}22`, color: pri.color }}>{pri.label}</span></td>
      <td>{i.title.slice(0, 50)}</td>
      <td className="text-muted-foreground">{Number(i.lat).toFixed(3)}, {Number(i.lng).toFixed(3)}</td>
      <td>{i.assigned_drone_id ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">ASSIGNED</span> : <span className="text-muted-foreground">—</span>}</td>
      <td><span className="text-[11px] font-semibold" style={{ color: status.color }}>{status.label}</span></td>
      <td><Link to="/incidents" className="rounded border border-primary/50 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary hover:bg-primary/25">View</Link></td>
    </tr>
  );
}
