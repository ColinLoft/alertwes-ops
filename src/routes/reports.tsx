import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, FileText, X, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchIncidents, STATUS_META, PRIORITY_META, type IncidentRow } from "@/lib/incidents";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Aegis Command" }] }),
  component: ReportsPage,
  ssr: false,
});

interface ReportRow {
  id: string;
  incident_id: string | null;
  title: string;
  body: string;
  status: "draft" | "final";
  author: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchReports(): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("incident_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

function ReportsPage() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const { data: reports = [] } = useQuery({ queryKey: ["reports"], queryFn: fetchReports, refetchInterval: 30_000 });
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "final">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const ch = supabase.channel("reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_reports" },
        () => qc.invalidateQueries({ queryKey: ["reports"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q);
    });
  }, [reports, search, statusFilter]);

  const selected = selectedId ? reports.find((r) => r.id === selectedId) ?? null : null;
  const activeIncidents = incidents.filter((i) => !["closed", "false_positive"].includes(i.status));

  return (
    <div className="flex h-full w-full">
      {/* List pane */}
      <aside className="w-[380px] shrink-0 flex flex-col border-r border-white/10 glass-subtle">
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">Incident Reports</div>
            <button onClick={() => { setCreating(true); setSelectedId(null); }}
              className="ml-auto inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:brightness-110">
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-white/10 bg-background px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or body…"
              className="w-full bg-transparent text-xs outline-none" />
          </div>
          <div className="mt-2 flex gap-1">
            {(["all", "draft", "final"] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${statusFilter === s ? "bg-primary/20 text-primary border border-primary/40" : "border border-white/10 text-muted-foreground"}`}>
                {s}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground self-center">{visible.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">No reports.</div>
          )}
          {visible.map((r) => {
            const inc = r.incident_id ? incidents.find((i) => i.id === r.incident_id) : null;
            const active = r.id === selectedId;
            return (
              <button key={r.id} onClick={() => { setSelectedId(r.id); setCreating(false); }}
                className={`block w-full text-left border-b border-white/5 px-3 py-2.5 hover:bg-white/[0.04] ${active ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${r.status === "final" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {r.status}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 text-[12.5px] font-medium truncate">{r.title}</div>
                {inc && (
                  <div className="text-[10px] text-muted-foreground truncate">
                    Linked: {inc.title}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Detail / editor pane */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {creating ? (
          <ReportEditor mode="create" userId={userId} incidents={activeIncidents}
            onCancel={() => setCreating(false)}
            onSaved={(id) => { setCreating(false); setSelectedId(id); qc.invalidateQueries({ queryKey: ["reports"] }); }} />
        ) : selected ? (
          <ReportEditor mode="edit" key={selected.id} report={selected} userId={userId} incidents={incidents}
            onCancel={() => setSelectedId(null)}
            onSaved={() => qc.invalidateQueries({ queryKey: ["reports"] })}
            onDeleted={() => { setSelectedId(null); qc.invalidateQueries({ queryKey: ["reports"] }); }} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select a report or click <span className="mx-1 font-semibold text-foreground">New</span> to create one.
          </div>
        )}
      </div>
    </div>
  );
}

function ReportEditor({ mode, report, userId, incidents, onSaved, onCancel, onDeleted }: {
  mode: "create" | "edit";
  report?: ReportRow;
  userId: string | null;
  incidents: IncidentRow[];
  onSaved: (id: string) => void;
  onCancel: () => void;
  onDeleted?: () => void;
}) {
  const [title, setTitle] = useState(report?.title ?? "");
  const [body, setBody] = useState(report?.body ?? "");
  const [status, setStatus] = useState<"draft" | "final">(report?.status ?? "draft");
  const [incidentId, setIncidentId] = useState<string | "">(report?.incident_id ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      if (mode === "create") {
        const { data, error } = await supabase.from("incident_reports").insert({
          title: title.trim(), body, status,
          incident_id: incidentId || null,
          author: userId,
        }).select("id").single();
        if (error) throw error;
        toast.success("Report created");
        onSaved(data!.id);
      } else if (report) {
        const { error } = await supabase.from("incident_reports").update({
          title: title.trim(), body, status,
          incident_id: incidentId || null,
        }).eq("id", report.id);
        if (error) throw error;
        toast.success("Report saved");
        onSaved(report.id);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!report) return;
    if (!confirm("Delete this report?")) return;
    const { error } = await supabase.from("incident_reports").delete().eq("id", report.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onDeleted?.();
  };

  const linkedIncident = incidentId ? incidents.find((i) => i.id === incidentId) : null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {mode === "create" ? "New report" : `Edit · ${new Date(report!.created_at).toLocaleString()}`}
        </div>
        <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Report title"
        className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-base font-semibold" />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Linked incident</div>
          <select value={incidentId} onChange={(e) => setIncidentId(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-background px-2 py-1.5 text-xs">
            <option value="">— None —</option>
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                [{PRIORITY_META[i.priority].label}] {i.title} ({STATUS_META[i.status].label})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</div>
          <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "final")}
            className="w-full rounded-md border border-white/10 bg-background px-2 py-1.5 text-xs">
            <option value="draft">Draft</option>
            <option value="final">Final</option>
          </select>
        </label>
      </div>

      {linkedIncident && (
        <Link to="/incidents" className="block rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-muted-foreground hover:bg-white/[0.06]">
          → View linked incident in CAD: <span className="text-foreground font-medium">{linkedIncident.title}</span>
        </Link>
      )}

      <textarea value={body} onChange={(e) => setBody(e.target.value)}
        rows={18} placeholder="Narrative, actions taken, observations, follow-up…"
        className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm font-mono resize-y" />

      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : mode === "create" ? "Create report" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button onClick={remove}
            className="ml-auto inline-flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
