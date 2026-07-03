import { X, Search, Flame, Radio, Sparkles, Camera as CameraIcon, Plane as PlaneIcon, Check, ThumbsDown, VolumeX, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMission, type DrawerKey } from "@/lib/mission-store";
import { fetchIncidents, PRIORITY_META, STATUS_META, type IncidentRow } from "@/lib/incidents";
import { fetchDrones, STATUS_META as DRONE_META, type DroneRow } from "@/lib/drones";
import type { Camera } from "@/lib/alertwest";
import { fetchPendingSuggestions, dismissSuggestion, promoteSuggestion, muteCamera, markFalsePositive, fetchCameraHealth, type SuggestionRow } from "@/lib/suggestions";

interface DrawerProps {
  cameras: Camera[];
}

export function MissionDrawer({ cameras }: DrawerProps) {
  const drawer = useMission((s) => s.drawer);
  const setDrawer = useMission((s) => s.setDrawer);
  const select = useMission((s) => s.select);
  const flyTo = useMission((s) => s.flyTo);
  const [q, setQ] = useState("");

  if (!drawer) return null;

  return (
    <div className="pointer-events-auto absolute left-14 top-0 bottom-0 z-[1040] flex w-[300px] flex-col border-r border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl">
      <div className="flex h-9 items-center gap-2 border-b border-white/10 px-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          {drawerTitle(drawer)}
        </div>
        <button onClick={() => setDrawer(null)} className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-white/10 p-2">
        <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2 py-1">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {drawer === "incidents" && (
          <IncidentsList query={q} onOpen={(id, lat, lng) => { select({ kind: "incident", id }); flyTo(lat, lng, 12); }} />
        )}
        {drawer === "cameras" && (
          <CamerasList
            cameras={cameras}
            query={q}
            onOpen={(c) => {
              select({ kind: "camera", id: c.site.id, payload: c });
              const la = Number(c.site.latitude), ln = Number(c.site.longitude);
              if (Number.isFinite(la) && Number.isFinite(ln)) flyTo(la, ln, 13);
            }}
          />
        )}
        {drawer === "units" && (
          <UnitsList query={q} onOpen={(d) => {
            select({ kind: "aircraft", id: d.id, payload: d });
            if (d.last_lat != null && d.last_lng != null) flyTo(d.last_lat, d.last_lng, 11);
          }} />
        )}
      </div>
    </div>
  );
}

function drawerTitle(d: Exclude<DrawerKey, null>) {
  return d === "incidents" ? "Active Calls" : d === "cameras" ? "Cameras" : d === "units" ? "Aircraft" : "";
}

/* ---------------- Lists ---------------- */

function IncidentsList({ query, onOpen }: { query: string; onOpen: (id: string, lat: number, lng: number) => void }) {
  const { data: rows = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents, refetchInterval: 30_000 });
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = rows.filter((i) => !["closed", "false_positive"].includes(i.status));
    if (!q) return active;
    return active.filter((i) => i.title.toLowerCase().includes(q) || (i.county ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  if (filtered.length === 0) {
    return <Empty icon={Radio} label="No active calls" />;
  }
  return (
    <ul className="p-1.5">
      {filtered.map((i: IncidentRow) => {
        const sm = STATUS_META[i.status]; const pm = PRIORITY_META[i.priority];
        return (
          <li key={i.id}>
            <button onClick={() => onOpen(i.id, i.lat, i.lng)} className="w-full rounded-md border border-white/5 bg-white/[0.02] p-2 text-left hover:bg-white/[0.06] mb-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded px-1 py-0.5 text-[9px] font-bold" style={{ background: `${pm.color}22`, color: pm.color }}>{pm.label}</span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: sm.color }}>{sm.label}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{timeAgo(i.discovered_at)}</span>
              </div>
              <div className="mt-1 line-clamp-1 text-[12px] font-medium">{i.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{i.county ?? "—"} · {i.lat.toFixed(3)}, {i.lng.toFixed(3)}</div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CamerasList({ cameras, query, onOpen }: { cameras: Camera[]; query: string; onOpen: (c: Camera) => void }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cameras.slice(0, 200);
    return cameras.filter((c) => c.name.toLowerCase().includes(q) || (c.site.county ?? "").toLowerCase().includes(q)).slice(0, 200);
  }, [cameras, query]);
  if (filtered.length === 0) return <Empty icon={CameraIcon} label="No cameras in this area" />;
  return (
    <ul className="p-1.5">
      {filtered.map((c) => (
        <li key={c.site.id}>
          <button onClick={() => onOpen(c)} className="mb-1 flex w-full items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] p-2 text-left hover:bg-white/[0.06]">
            {c.image.url ? (
              <img src={c.image.url} alt="" className="h-9 w-14 rounded object-cover" loading="lazy" />
            ) : (
              <div className="grid h-9 w-14 place-items-center rounded bg-white/5"><CameraIcon className="h-4 w-4 text-muted-foreground" /></div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium">{c.name}</div>
              <div className="truncate text-[10px] text-muted-foreground">{c.site.county ?? "—"}, {c.site.state ?? "—"}</div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function UnitsList({ query, onOpen }: { query: string; onOpen: (d: DroneRow) => void }) {
  const { data: rows = [] } = useQuery({ queryKey: ["drones"], queryFn: fetchDrones, refetchInterval: 60_000 });
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((d) => d.tail_number.toLowerCase().includes(q) || (d.base?.code ?? "").toLowerCase().includes(q));
  }, [rows, query]);
  if (filtered.length === 0) return <Empty icon={PlaneIcon} label="No aircraft" />;
  return (
    <ul className="p-1.5">
      {filtered.map((d) => {
        const sm = DRONE_META[d.status];
        return (
          <li key={d.id}>
            <button onClick={() => onOpen(d)} className="mb-1 w-full rounded-md border border-white/5 bg-white/[0.02] p-2 text-left hover:bg-white/[0.06]">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.dot }} />
                <span className="text-[12px] font-semibold">{d.tail_number}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider" style={{ color: sm.color }}>{sm.label}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{d.airframe?.model ?? "—"}</span>
                <span>· {d.base?.code ?? "no base"}</span>
                <span className="ml-auto font-mono">{d.battery_pct}%</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* -------- Triage floating panel (separate — invoked by unread count) -------- */

export function TriagePanel({ onFocusCamera }: { onFocusCamera: (s: SuggestionRow) => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const { data: sugs = [] } = useQuery({ queryKey: ["suggestions"], queryFn: fetchPendingSuggestions, refetchInterval: 30_000 });
  const { data: health = {} } = useQuery({ queryKey: ["camera_health"], queryFn: fetchCameraHealth, refetchInterval: 60_000 });
  if (sugs.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute left-16 top-3 z-[1045] max-w-[92vw] rounded-xl border border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2 px-3 py-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">AI Triage</div>
        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">{sugs.length}</span>
        <span className="text-[10px] text-muted-foreground">{expanded ? "hide" : "review"}</span>
      </button>
      {expanded && (
        <div className="flex max-w-[900px] gap-2 overflow-x-auto p-2 pt-0">
          {sugs.map((s) => {
            const h = s.camera_id ? health[s.camera_id] : undefined;
            const hColor = !h ? "text-muted-foreground" : h.score >= 75 ? "text-emerald-300" : h.score >= 50 ? "text-amber-300" : "text-rose-300";
            return (
              <div key={s.id} className="shrink-0 w-[220px] overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                {s.image_url && (
                  <button onClick={() => onFocusCamera(s)} className="block w-full">
                    <img src={s.image_url} alt="" className="h-[80px] w-full object-cover hover:brightness-110" />
                  </button>
                )}
                <div className="space-y-1 p-1.5">
                  <div className="flex items-center gap-1">
                    <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${s.label === "fire" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>{s.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{s.confidence}%</span>
                    <ShieldCheck className={`ml-auto h-3 w-3 ${hColor}`} />
                    <span className={`font-mono text-[9px] ${hColor}`}>{h ? `${h.score}%` : "—"}</span>
                  </div>
                  <div className="line-clamp-1 text-[10px] text-muted-foreground">{s.camera_name}</div>
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        try { const id = await promoteSuggestion(s); toast.success("Incident opened"); qc.invalidateQueries({ queryKey: ["incidents"] }); qc.invalidateQueries({ queryKey: ["suggestions"] }); useMission.getState().select({ kind: "incident", id }); } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                      }}
                      className="flex-1 rounded bg-emerald-500/20 px-1.5 py-1 text-[9.5px] font-semibold text-emerald-300 hover:bg-emerald-500/30"
                    ><Check className="mx-auto h-3 w-3" /></button>
                    <button
                      onClick={async () => { await markFalsePositive(s.id); toast.success("Marked FP"); qc.invalidateQueries({ queryKey: ["suggestions"] }); qc.invalidateQueries({ queryKey: ["camera_health"] }); }}
                      className="flex-1 rounded bg-rose-500/15 px-1.5 py-1 text-[9.5px] font-semibold text-rose-300 hover:bg-rose-500/25"
                    ><ThumbsDown className="mx-auto h-3 w-3" /></button>
                    <button
                      onClick={async () => { try { await muteCamera(s.camera_id ?? "", s.camera_name, 24, "Muted from map"); toast.success("Muted 24h"); qc.invalidateQueries({ queryKey: ["suggestions"] }); } catch (e: any) { toast.error(e?.message ?? "Failed"); } }}
                      className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-amber-300 hover:bg-amber-500/20"
                    ><VolumeX className="h-3 w-3" /></button>
                    <button
                      onClick={async () => { await dismissSuggestion(s.id); qc.invalidateQueries({ queryKey: ["suggestions"] }); }}
                      className="rounded border border-white/10 px-1.5 py-1 hover:bg-white/5"
                    ><X className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="grid h-full min-h-[120px] place-items-center px-4 text-center">
      <div>
        <Icon className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
