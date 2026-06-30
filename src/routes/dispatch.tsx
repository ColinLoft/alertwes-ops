import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, X, MapPin } from "lucide-react";
import { fetchIncidents, fetchIncidentEvents, PRIORITY_META, STATUS_META, type IncidentRow } from "@/lib/incidents";

export const Route = createFileRoute("/dispatch")({
  head: () => ({ meta: [{ title: "Active Calls — Aegis Dispatch" }] }),
  component: DispatchPage,
  ssr: false,
});

function DispatchPage() {
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 15_000 });
  const active = useMemo(() => incidents.filter((i) => !["closed", "false_positive"].includes(i.status)), [incidents]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => active.find((i) => i.id === selectedId) ?? null, [active, selectedId]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden border-r border-white/10">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/10">
          <Radio className="h-4 w-4 text-primary" />
          <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/90">Active Calls</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">({active.length})</span>
          <Link to="/dispatch/units" className="ml-auto text-[10px] uppercase tracking-wider text-primary hover:underline">Manage units →</Link>
        </div>
        <div className="flex-1 overflow-auto">
          {active.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">No active calls.</div>
          ) : (
            <table className="cad-table">
              <thead>
                <tr>
                  <th>Source</th><th>Call #</th><th>Pri</th><th>Type</th><th>Location</th><th>Status</th><th>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {active.map((i) => <CallRow key={i.id} i={i} active={i.id === selectedId} onOpen={() => setSelectedId(i.id)} />)}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && <CallDetail incident={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function CallRow({ i, active, onOpen }: { i: IncidentRow; active: boolean; onOpen: () => void }) {
  const pri = PRIORITY_META[i.priority];
  const status = STATUS_META[i.status];
  return (
    <tr onClick={onOpen} className={`cursor-pointer ${active ? "is-selected" : ""}`}>
      <td><span className="rounded px-1.5 py-0.5 text-[9.5px] font-black tracking-wider" style={{ background: "oklch(0.55 0.22 25)", color: "white" }}>{i.source.toUpperCase()}</span></td>
      <td className="font-mono font-bold text-primary">{i.id.slice(0, 8).toUpperCase()}</td>
      <td><span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ background: `${pri.color}22`, color: pri.color }}>{pri.label}</span></td>
      <td>{i.title.slice(0, 60)}</td>
      <td className="text-muted-foreground font-mono text-[10.5px]">{Number(i.lat).toFixed(3)}, {Number(i.lng).toFixed(3)}</td>
      <td><span className="text-[11px] font-semibold" style={{ color: status.color }}>{status.label}</span></td>
      <td>{i.assigned_drone_id ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">ASSIGNED</span> : <span className="text-muted-foreground">—</span>}</td>
    </tr>
  );
}

function CallDetail({ incident, onClose }: { incident: IncidentRow; onClose: () => void }) {
  const { data: events = [] } = useQuery({ queryKey: ["incident_events", incident.id], queryFn: () => fetchIncidentEvents(incident.id) });
  const pri = PRIORITY_META[incident.priority];
  const status = STATUS_META[incident.status];
  return (
    <aside className="w-[400px] shrink-0 flex flex-col overflow-y-auto bg-white/[0.02]">
      <div className="p-3 border-b border-white/10 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
            <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: `${pri.color}22`, color: pri.color, border: `1px solid ${pri.color}66` }}>{pri.label}</span>
            <span style={{ color: status.color }}>{status.label}</span>
            <span className="font-mono text-primary">#{incident.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="mt-1.5 text-sm font-semibold">{incident.title}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground font-mono flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {Number(incident.lat).toFixed(4)}, {Number(incident.lng).toFixed(4)}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="p-3 border-b border-white/10 grid grid-cols-2 gap-2 text-[11px]">
        <Field label="Source" value={incident.source} />
        <Field label="County" value={incident.county ?? "—"} />
        <Field label="Discovered" value={new Date(incident.discovered_at).toLocaleString()} />
        <Field label="Assigned" value={incident.assigned_drone_id ? incident.assigned_drone_id.slice(0, 8) : "—"} />
      </div>

      <div className="p-3 border-b border-white/10">
        <Link to="/incidents"
          className="block w-full text-center rounded bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
          Open full incident →
        </Link>
      </div>

      <div className="p-3 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Activity</div>
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground">No events yet.</div>
        ) : (
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="text-[11px] border-l border-white/10 pl-2">
                <div className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</div>
                <div className="text-foreground whitespace-pre-wrap">{e.message ?? e.event_type}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground">{value}</div>
    </div>
  );
}
