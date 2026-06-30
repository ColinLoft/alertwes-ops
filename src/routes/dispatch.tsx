import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radio, X, MapPin, StickyNote, Send, ExternalLink, Clock as ClockIcon, Flame } from "lucide-react";
import { toast } from "sonner";
import {
  fetchIncidents, fetchIncidentEvents, updateIncidentStatus,
  PRIORITY_META, STATUS_META,
  type IncidentRow, type IncidentStatus,
} from "@/lib/incidents";
import { supabase } from "@/integrations/supabase/client";
import { DispatchPanel } from "@/components/DispatchPanel";

export const Route = createFileRoute("/dispatch")({
  head: () => ({ meta: [{ title: "Active Calls — Aegis Command" }] }),
  component: DispatchPage,
  ssr: false,
});

const STATUS_FLOW: IncidentStatus[] = ["new", "triaging", "dispatched", "onscene", "contained", "closed"];

function DispatchPage() {
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 15_000 });
  const active = useMemo(() => incidents.filter((i) => !["closed", "false_positive"].includes(i.status)), [incidents]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => active.find((i) => i.id === selectedId) ?? active[0] ?? null, [active, selectedId]);

  return (
    <div className="flex h-full">
      <div className="w-[44%] min-w-[460px] flex flex-col overflow-hidden border-r border-white/10">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/10">
          <Radio className="h-4 w-4 text-primary" />
          <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/90">Active Calls</h2>
          <span className="text-[11px] tabular-nums text-muted-foreground">({active.length})</span>
          <Link to="/dispatch/units" className="ml-auto text-[10px] uppercase tracking-wider text-primary hover:underline">Units →</Link>
        </div>
        <div className="flex-1 overflow-auto">
          {active.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">No active calls.</div>
          ) : (
            <table className="cad-table">
              <thead>
                <tr>
                  <th>Pri</th><th>Call #</th><th>Type</th><th>Status</th><th>Loc</th>
                </tr>
              </thead>
              <tbody>
                {active.map((i) => <CallRow key={i.id} i={i} active={i.id === selected?.id} onOpen={() => setSelectedId(i.id)} />)}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        {selected ? <CallDetail incident={selected} onClose={() => setSelectedId(null)} /> : (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">Select an active call.</div>
        )}
      </div>
    </div>
  );
}

function CallRow({ i, active, onOpen }: { i: IncidentRow; active: boolean; onOpen: () => void }) {
  const pri = PRIORITY_META[i.priority];
  const status = STATUS_META[i.status];
  return (
    <tr onClick={onOpen} className={`cursor-pointer ${active ? "is-selected" : ""}`}>
      <td><span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ background: `${pri.color}22`, color: pri.color }}>{pri.label}</span></td>
      <td className="font-mono font-bold text-primary">{i.id.slice(0, 8).toUpperCase()}</td>
      <td className="max-w-[200px] truncate">{i.title}</td>
      <td><span className="text-[11px] font-semibold" style={{ color: status.color }}>{status.label}</span></td>
      <td className="text-muted-foreground font-mono text-[10px]">{Number(i.lat).toFixed(2)},{Number(i.lng).toFixed(2)}</td>
    </tr>
  );
}

function CallDetail({ incident, onClose }: { incident: IncidentRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: events = [] } = useQuery({
    queryKey: ["incident_events", incident.id],
    queryFn: () => fetchIncidentEvents(incident.id),
    refetchInterval: 10_000,
  });
  const pri = PRIORITY_META[incident.priority];
  const status = STATUS_META[incident.status];

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const elapsed = useMemo(() => {
    const ms = Date.now() - new Date(incident.discovered_at).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }, [incident.discovered_at]);

  const addNote = async (addToReport: boolean) => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const actor = u.user?.email ?? "operator";
      await supabase.from("incident_events").insert({
        incident_id: incident.id,
        event_type: "note",
        message: trimmed,
        actor,
      });
      if (addToReport) {
        const { data: report } = await supabase
          .from("incident_reports").select("id, body").eq("incident_id", incident.id).maybeSingle();
        const stamp = new Date().toLocaleString();
        const line = `\n\n[${stamp} · ${actor}] ${trimmed}`;
        if (report?.id) {
          await supabase.from("incident_reports")
            .update({ body: (report.body ?? "") + line })
            .eq("id", report.id);
        } else {
          await supabase.from("incident_reports").insert({
            incident_id: incident.id,
            title: `Incident Report: ${incident.title}`,
            body: line.trimStart(),
            status: "draft",
          });
        }
      }
      setNote("");
      toast.success(addToReport ? "Note added to report" : "Note logged");
      qc.invalidateQueries({ queryKey: ["incident_events", incident.id] });
      qc.invalidateQueries({ queryKey: ["incident_reports"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (s: IncidentStatus) => {
    try {
      await updateIncidentStatus(incident.id, s);
      toast.success(`Status → ${STATUS_META[s].label}`);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["incident_events", incident.id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-3 border-b border-white/10 flex items-start gap-3 bg-white/[0.02]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
              <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: `${pri.color}22`, color: pri.color, border: `1px solid ${pri.color}66` }}>{pri.label}</span>
              <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: `${status.color}22`, color: status.color }}>{status.label}</span>
              <span className="font-mono text-primary">#{incident.id.slice(0, 8).toUpperCase()}</span>
              <span className="text-muted-foreground flex items-center gap-1"><ClockIcon className="h-3 w-3" />{elapsed} elapsed</span>
            </div>
            <div className="mt-1.5 text-base font-bold flex items-center gap-2"><Flame className="h-4 w-4 text-orange-400" />{incident.title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground font-mono flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {Number(incident.lat).toFixed(5)}, {Number(incident.lng).toFixed(5)}
              {incident.county && <span className="ml-2">· {incident.county}{incident.state ? `, ${incident.state}` : ""}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="Close"><X className="h-4 w-4" /></button>
        </div>

        {/* Quick facts */}
        <div className="px-3 py-2 border-b border-white/10 grid grid-cols-4 gap-2 text-[11px]">
          <Field label="Source" value={incident.source.toUpperCase()} />
          <Field label="Confidence" value={incident.confidence != null ? `${incident.confidence}%` : "—"} />
          <Field label="FRP" value={incident.frp != null ? Number(incident.frp).toFixed(1) : "—"} />
          <Field label="Acreage" value={incident.acreage != null ? Number(incident.acreage).toFixed(1) : "—"} />
          <Field label="Discovered" value={new Date(incident.discovered_at).toLocaleTimeString()} />
          <Field label="Created" value={new Date(incident.created_at).toLocaleTimeString()} />
          <Field label="Unit" value={incident.assigned_drone_id ? incident.assigned_drone_id.slice(0, 8).toUpperCase() : "—"} />
          <Field label="Ext ID" value={incident.external_id ?? "—"} />
        </div>

        {/* Status quick flow */}
        <div className="px-3 py-2 border-b border-white/10">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">Status</div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FLOW.map((s) => {
              const m = STATUS_META[s];
              const active = s === incident.status;
              return (
                <button key={s} onClick={() => !active && changeStatus(s)}
                  className={`rounded-sm px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider border transition ${
                    active ? "border-transparent" : "border-white/10 hover:bg-white/5"
                  }`}
                  style={active ? { background: `${m.color}22`, color: m.color, borderColor: `${m.color}66` } : { color: m.color }}
                >
                  {m.label}
                </button>
              );
            })}
            <button onClick={() => changeStatus("false_positive")}
              className="rounded-sm px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider border border-white/10 text-slate-400 hover:bg-white/5 ml-auto">
              False positive
            </button>
          </div>
        </div>

        {/* Quick notes */}
        <div className="px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1.5">
            <StickyNote className="h-3.5 w-3.5 text-amber-400" />
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Quick note</div>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="On scene observations, unit updates, ETA changes, civilian reports..."
            rows={3}
            className="w-full rounded-sm border border-white/10 bg-black/30 px-2 py-1.5 text-[12px] font-mono text-foreground focus:outline-none focus:border-primary/50 resize-y"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              disabled={!note.trim() || saving}
              onClick={() => addNote(false)}
              className="rounded-sm border border-white/10 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-foreground/80 hover:bg-white/5 disabled:opacity-40"
            >
              Log note
            </button>
            <button
              disabled={!note.trim() || saving}
              onClick={() => addNote(true)}
              className="inline-flex items-center gap-1 rounded-sm bg-primary px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-40"
            >
              <Send className="h-3 w-3" /> Add to report
            </button>
            <Link
              to="/reports"
              className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Open report
            </Link>
            <Link
              to="/incidents"
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <MapPin className="h-3 w-3" /> View on map
            </Link>
          </div>
        </div>

        {/* Activity */}
        <div className="px-3 py-2 flex-1 min-h-0">
          <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Activity ({events.length})</div>
          {events.length === 0 ? (
            <div className="text-xs text-muted-foreground">No events yet.</div>
          ) : (
            <ol className="space-y-1.5">
              {events.map((e) => (
                <li key={e.id} className="text-[11px] border-l-2 border-white/10 pl-2 py-0.5">
                  <div className="flex items-center gap-2 text-muted-foreground text-[10px]">
                    <span className="font-mono">{new Date(e.created_at).toLocaleTimeString()}</span>
                    <span className="uppercase tracking-wider font-bold" style={{ color: e.event_type === "note" ? "#fbbf24" : undefined }}>{e.event_type}</span>
                    {e.actor && <span className="text-muted-foreground/70">· {e.actor}</span>}
                  </div>
                  <div className="text-foreground whitespace-pre-wrap mt-0.5">{e.message ?? "—"}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Dispatch sidebar */}
      <aside className="w-[280px] shrink-0 border-l border-white/10 bg-black/20 overflow-y-auto">
        <DispatchPanel incident={incident} />
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-white/5 bg-white/[0.02] px-2 py-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground font-mono text-[11px] truncate">{value}</div>
    </div>
  );
}
