import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Flame, AlertTriangle, Camera as CameraIcon, Plane, FileText, Activity, ThumbsDown, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchIncidents, STATUS_META, PRIORITY_META, type IncidentRow } from "@/lib/incidents";
import { fetchCameras } from "@/lib/alertwest";
import { fetchDetectionArea, isInDetectionArea } from "@/lib/area";
import { getFirmsHotspots } from "@/lib/firms.functions";
import { getRedFlagAlerts } from "@/lib/nws.functions";
import { fetchSweepStatus, fetchCameraHealth, type CameraHealth } from "@/lib/suggestions";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Aegis Command" }] }),
  component: AnalyticsPage,
  ssr: false,
});

async function fetchReports() {
  const { data, error } = await supabase.from("incident_reports").select("id,status,created_at").limit(1000);
  if (error) throw error;
  return data ?? [];
}

async function fetchSuggestionsAll() {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("incident_suggestions")
    .select("id,status,label,camera_id,camera_name,confidence,created_at,lat,lng,state,county")
    .gte("created_at", since)
    .limit(2000);
  if (error) throw error;
  return data ?? [];
}

function AnalyticsPage() {
  const firmsFn = useServerFn(getFirmsHotspots);
  const nwsFn = useServerFn(getRedFlagAlerts);

  const { data: area } = useQuery({ queryKey: ["detection_area"], queryFn: fetchDetectionArea });
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 60_000 });
  const { data: cameras = [] } = useQuery({ queryKey: ["aw-cameras"], queryFn: fetchCameras, staleTime: 5 * 60_000 });
  const { data: firms } = useQuery({ queryKey: ["firms"], queryFn: () => firmsFn(), refetchInterval: 15 * 60_000 });
  const { data: nws } = useQuery({ queryKey: ["nws-redflag"], queryFn: () => nwsFn(), refetchInterval: 5 * 60_000 });
  const { data: sweepStatus } = useQuery({ queryKey: ["sweep_status"], queryFn: fetchSweepStatus, refetchInterval: 30_000 });
  const { data: cameraHealth = {} } = useQuery({ queryKey: ["camera_health"], queryFn: fetchCameraHealth, refetchInterval: 60_000 });
  const { data: reports = [] } = useQuery({ queryKey: ["reports_all"], queryFn: fetchReports, refetchInterval: 60_000 });
  const { data: sugg = [] } = useQuery({ queryKey: ["suggestions_7d"], queryFn: fetchSuggestionsAll, refetchInterval: 60_000 });

  const inAreaCameras = useMemo(() => {
    if (!area) return cameras;
    return cameras.filter((c) => {
      const lat = Number(c.site.latitude), lng = Number(c.site.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return false;
      return isInDetectionArea({ lat, lng, state: c.site.state, county: c.site.county }, area);
    });
  }, [cameras, area]);

  const hotspots = useMemo(() => {
    const all = firms?.hotspots ?? [];
    if (!area) return all;
    return all.filter((h) => isInDetectionArea({ lat: h.lat, lng: h.lng }, area));
  }, [firms, area]);

  const redFlag = useMemo(() => {
    const all = nws?.alerts ?? [];
    if (!area) return all;
    return all.filter((a: any) => {
      if (a.lat != null && a.lng != null && isInDetectionArea({ lat: a.lat, lng: a.lng }, area)) return true;
      if (area.states?.length && a.states?.some((s: string) => area.states.includes(s))) return true;
      return false;
    });
  }, [nws, area]);

  // KPI breakdowns
  const active = incidents.filter((i) => !["closed", "false_positive"].includes(i.status));
  const last24h = incidents.filter((i) => Date.now() - new Date(i.discovered_at).getTime() < 86400_000);
  const byStatus = useMemo(() => groupBy(incidents, (i) => i.status), [incidents]);
  const byPriority = useMemo(() => groupBy(incidents, (i) => i.priority), [incidents]);
  const bySource = useMemo(() => groupBy(incidents, (i) => i.source), [incidents]);

  const sugStats = useMemo(() => {
    const total = sugg.length;
    const promoted = sugg.filter((s: any) => s.status === "promoted").length;
    const fp = sugg.filter((s: any) => s.status === "false_positive").length;
    const pending = sugg.filter((s: any) => s.status === "pending").length;
    const dismissed = sugg.filter((s: any) => s.status === "dismissed").length;
    const pct = total ? Math.round((promoted / total) * 100) : 0;
    return { total, promoted, fp, pending, dismissed, pct };
  }, [sugg]);

  // Top problem cameras by health (low score)
  const worstCams = useMemo(() => {
    const entries: Array<{ id: string; name: string; h: CameraHealth }> = [];
    for (const id in cameraHealth) {
      const h = cameraHealth[id];
      if ((h.confirmed + h.false_positive) < 2) continue;
      entries.push({ id, name: id, h });
    }
    return entries.sort((a, b) => a.h.score - b.h.score).slice(0, 8);
  }, [cameraHealth]);

  // Incidents per day (last 14d)
  const trend = useMemo(() => {
    const days = 14;
    const buckets: { day: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      buckets.push({ day: d.toISOString().slice(5, 10), count: 0 });
    }
    for (const i of incidents) {
      const d = new Date(i.discovered_at); d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(5, 10);
      const b = buckets.find((x) => x.day === key);
      if (b) b.count++;
    }
    return buckets;
  }, [incidents]);
  const trendMax = Math.max(1, ...trend.map((t) => t.count));

  const reportStats = {
    total: reports.length,
    draft: reports.filter((r: any) => r.status === "draft").length,
    final: reports.filter((r: any) => r.status === "final").length,
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Operational Analytics</h1>
          <div className="ml-auto text-[11px] text-muted-foreground">
            {area ? <>Area: <span className="text-foreground font-mono">{area.mode === "address" ? `${area.address ?? "—"} · ${Number(area.radius_mi)} mi` : `${(area.states ?? []).join(",") || "—"} ${(area.counties ?? []).length ? "· " + (area.counties ?? []).join(",") : ""}`}</span></> : "Loading area…"}
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={<Flame className="h-3.5 w-3.5" />} label="Active incidents" value={active.length} sub={`${last24h.length} last 24h`} />
          <Kpi icon={<CameraIcon className="h-3.5 w-3.5" />} label="Cameras in area" value={inAreaCameras.length} sub={`${cameras.length} total`} />
          <Kpi icon={<Flame className="h-3.5 w-3.5" />} label="FIRMS 24h (area)" value={hotspots.length} sub={`${firms?.hotspots?.length ?? 0} global`} />
          <Kpi icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Red Flag (area)" value={redFlag.length} sub={`${nws?.alerts?.length ?? 0} global`} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Trend */}
          <Panel className="lg:col-span-2" title="Incidents — last 14 days">
            <div className="flex items-end gap-1 h-[160px] px-1">
              {trend.map((t) => (
                <div key={t.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-primary/60" style={{ height: `${(t.count / trendMax) * 130}px` }} title={`${t.day}: ${t.count}`} />
                  <div className="text-[9px] font-mono text-muted-foreground">{t.day}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* AI sweep status */}
          <Panel title="AI sweep — live">
            <div className="space-y-2 text-[12px]">
              <Row label="Last run" value={sweepStatus?.last_run_at ? `${secondsAgo(sweepStatus.last_run_at)}` : "—"} icon={<Activity className="h-3 w-3" />} />
              <Row label="Last 2m queued" value={sweepStatus?.last_window_count ?? 0} />
              <Row label="Pending in area" value={sweepStatus?.pending_in_area ?? 0} />
              <Row label="Total 24h" value={sweepStatus?.total_24h ?? 0} />
              <div className="border-t border-white/10 pt-2 mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">7-day learning signal</div>
              <Row label="Confirmed" value={sugStats.promoted} icon={<ShieldCheck className="h-3 w-3 text-emerald-300" />} />
              <Row label="False positive" value={sugStats.fp} icon={<ThumbsDown className="h-3 w-3 text-rose-300" />} />
              <Row label="Pending / dismissed" value={`${sugStats.pending} / ${sugStats.dismissed}`} />
              <Row label="Hit rate" value={`${sugStats.pct}%`} />
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Breakdown bars */}
          <Panel title="Incidents by status">
            <Bars data={Object.entries(byStatus).map(([k, v]) => ({ label: STATUS_META[k as IncidentRow["status"]]?.label ?? k, value: v, color: STATUS_META[k as IncidentRow["status"]]?.color }))} />
          </Panel>
          <Panel title="Incidents by priority">
            <Bars data={Object.entries(byPriority).map(([k, v]) => ({ label: PRIORITY_META[k as IncidentRow["priority"]]?.label ?? k, value: v, color: PRIORITY_META[k as IncidentRow["priority"]]?.color }))} />
          </Panel>
          <Panel title="Incidents by source">
            <Bars data={Object.entries(bySource).map(([k, v]) => ({ label: k.toUpperCase(), value: v }))} />
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Reports">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Mini label="Total" value={reportStats.total} icon={<FileText className="h-3 w-3" />} />
              <Mini label="Draft" value={reportStats.draft} />
              <Mini label="Final" value={reportStats.final} />
            </div>
          </Panel>

          <Panel title="Worst-performing cameras (low health)">
            {worstCams.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic">Not enough signal yet. Confirm / mark false on triage cards to populate.</div>
            ) : (
              <ul className="text-[11px] space-y-1">
                {worstCams.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground truncate w-[140px]">{c.id}</span>
                    <span className="flex-1 h-1.5 rounded bg-white/10 overflow-hidden">
                      <span className="block h-full" style={{ width: `${c.h.score}%`, background: c.h.score >= 75 ? "#34d399" : c.h.score >= 50 ? "#fbbf24" : "#f43f5e" }} />
                    </span>
                    <span className="font-mono w-[60px] text-right">{c.h.score}/100</span>
                    <span className="font-mono w-[64px] text-right text-muted-foreground">✓{c.h.confirmed} ✗{c.h.false_positive}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) { const k = key(x); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

function secondsAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? `${Math.floor(s)}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
}

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/[0.03] ${className ?? ""}`}>
      <div className="px-3 py-2 border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Mini({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded border border-white/10 bg-background/40 p-2">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground w-[140px]">{icon}{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Bars({ data }: { data: Array<{ label: string; value: number; color?: string }> }) {
  if (!data.length) return <div className="text-[11px] text-muted-foreground italic">No data.</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-[88px] text-muted-foreground">{d.label}</span>
          <span className="flex-1 h-2 rounded bg-white/5 overflow-hidden">
            <span className="block h-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? "var(--primary)" }} />
          </span>
          <span className="font-mono w-[36px] text-right">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}
