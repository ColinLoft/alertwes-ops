import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, AlertTriangle, Flame, Plane, Radio, MessageSquare } from "lucide-react";
import { useMission } from "@/lib/mission-store";

interface FeedItem {
  id: string;
  kind: "event" | "suggestion";
  ts: string;
  incident_id?: string | null;
  camera_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  title: string;
  detail?: string | null;
  tone: "info" | "warn" | "alert" | "success";
}

async function fetchFeed(): Promise<FeedItem[]> {
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const [{ data: ev }, { data: sug }] = await Promise.all([
    supabase.from("incident_events").select("id, incident_id, event_type, message, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("incident_suggestions").select("id, camera_id, camera_name, label, confidence, reasoning, lat, lng, created_at, status").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
  ]);
  const out: FeedItem[] = [];
  for (const e of ev ?? []) {
    out.push({
      id: `e:${e.id}`,
      kind: "event",
      ts: e.created_at,
      incident_id: e.incident_id,
      title: eventTitle(e.event_type),
      detail: e.message,
      tone: eventTone(e.event_type),
    });
  }
  for (const s of sug ?? []) {
    out.push({
      id: `s:${s.id}`,
      kind: "suggestion",
      ts: s.created_at,
      camera_id: s.camera_id,
      lat: s.lat,
      lng: s.lng,
      title: `${s.label === "fire" ? "🔥 Fire" : s.label === "smoke" ? "💨 Smoke" : "AI"} · ${s.camera_name ?? "camera"}`,
      detail: `${s.confidence}% · ${s.reasoning ?? ""}`.trim(),
      tone: s.label === "fire" ? "alert" : s.label === "smoke" ? "warn" : "info",
    });
  }
  out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return out.slice(0, 100);
}

function eventTitle(t: string) {
  switch (t) {
    case "created": return "Incident opened";
    case "dispatched": return "Aircraft dispatched";
    case "inflight": return "Aircraft in-flight";
    case "released": return "Aircraft released";
    case "status_change": return "Status change";
    case "note": return "Note added";
    default: return t;
  }
}
function eventTone(t: string): FeedItem["tone"] {
  if (t === "dispatched" || t === "inflight") return "success";
  if (t === "created") return "warn";
  return "info";
}

const TONE: Record<FeedItem["tone"], { bg: string; text: string; icon: any }> = {
  info:    { bg: "bg-slate-500/10 border-slate-500/25",     text: "text-slate-300",   icon: MessageSquare },
  success: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-300", icon: Plane },
  warn:    { bg: "bg-amber-500/10 border-amber-500/30",     text: "text-amber-300",   icon: Flame },
  alert:   { bg: "bg-rose-500/10 border-rose-500/40",       text: "text-rose-300",    icon: AlertTriangle },
};

export function LiveFeed() {
  const open = useMission((s) => s.feedOpen);
  const setOpen = useMission((s) => s.setFeedOpen);
  const select = useMission((s) => s.select);
  const flyTo = useMission((s) => s.flyTo);

  const { data: items = [], refetch } = useQuery({ queryKey: ["mission_feed"], queryFn: fetchFeed, refetchInterval: 30_000 });

  useEffect(() => {
    const ch = supabase
      .channel("mission-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_events" }, () => refetch())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_suggestions" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const latest = items[0];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-0 left-14 right-0 z-[1050] flex h-7 items-center gap-3 border-t border-white/10 bg-black/70 px-3 text-[11px] text-foreground/80 backdrop-blur-xl hover:bg-black/85"
      >
        <ChevronUp className="h-3 w-3" />
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">Live Feed</span>
        {latest ? (
          <span className="truncate">{timeAgo(latest.ts)} · {latest.title}</span>
        ) : (
          <span className="text-muted-foreground">No recent activity</span>
        )}
        <span className="ml-auto text-muted-foreground">{items.length} events</span>
      </button>
    );
  }

  return (
    <div className="absolute bottom-0 left-14 right-0 z-[1050] flex h-48 flex-col border-t border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="flex h-8 items-center gap-2 border-b border-white/10 px-3">
        <Radio className="h-3.5 w-3.5 text-emerald-400" />
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Live Activity</div>
        <span className="text-[11px] text-muted-foreground">{items.length} events · last 6h</span>
        <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">No activity in the last 6 hours</div>
        ) : (
          <ol className="space-y-1">
            {items.map((it) => {
              const tone = TONE[it.tone];
              const Icon = tone.icon;
              const clickable = it.incident_id || (it.lat != null && it.lng != null);
              return (
                <li
                  key={it.id}
                  onClick={() => {
                    if (it.incident_id) select({ kind: "incident", id: it.incident_id });
                    if (it.lat != null && it.lng != null) flyTo(it.lat, it.lng, 12);
                    if (it.camera_id && !it.incident_id) select({ kind: "camera", id: it.camera_id });
                  }}
                  className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-[11.5px] ${tone.bg} ${clickable ? "cursor-pointer hover:brightness-125" : ""}`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${tone.text}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold ${tone.text}`}>{it.title}</div>
                    {it.detail && <div className="truncate text-muted-foreground">{it.detail}</div>}
                  </div>
                  <div className="shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(it.ts)}</div>
                </li>
              );
            })}
          </ol>
        )}
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
