import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ShieldAlert, Waves, CloudLightning, ExternalLink } from "lucide-react";
import { getRecentQuakes, type Quake } from "@/lib/usgs.functions";
import { getRedFlagAlerts, type NwsAlert } from "@/lib/nws.functions";

export const Route = createFileRoute("/disaster")({
  head: () => ({ meta: [{ title: "Disaster Response — Aegis Command" }] }),
  component: DisasterPage,
  ssr: false,
});

type Tab = "quakes" | "redflag";

function magColor(m: number) {
  if (m >= 6) return "#ef4444";
  if (m >= 5) return "#f97316";
  if (m >= 4) return "#eab308";
  return "#64748b";
}

function DisasterPage() {
  const [tab, setTab] = useState<Tab>("quakes");
  const fetchQuakes = useServerFn(getRecentQuakes);
  const fetchAlerts = useServerFn(getRedFlagAlerts);

  const quakesQ = useQuery({
    queryKey: ["usgs-quakes"],
    queryFn: () => fetchQuakes({}),
    refetchInterval: 60_000,
  });
  const alertsQ = useQuery({
    queryKey: ["nws-redflag"],
    queryFn: () => fetchAlerts({}),
    refetchInterval: 60_000,
  });

  const quakes = useMemo<Quake[]>(
    () => (quakesQ.data?.quakes ?? []).sort((a, b) => b.mag - a.mag),
    [quakesQ.data],
  );
  const alerts = useMemo<NwsAlert[]>(() => alertsQ.data?.alerts ?? [], [alertsQ.data]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 bg-background/40 px-4 py-3">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider">Disaster Response</div>
          <div className="text-[11px] text-muted-foreground">
            USGS seismic activity & active NWS warnings. ISR drones can be dispatched from the Incidents board.
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-0.5">
          <button
            onClick={() => setTab("quakes")}
            className={`inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium ${
              tab === "quakes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Waves className="h-3.5 w-3.5" /> Earthquakes <span className="opacity-60">{quakes.length}</span>
          </button>
          <button
            onClick={() => setTab("redflag")}
            className={`inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium ${
              tab === "redflag" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CloudLightning className="h-3.5 w-3.5" /> Red Flag <span className="opacity-60">{alerts.length}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {tab === "quakes" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {quakes.map((q) => (
              <a
                key={q.id}
                href={q.url}
                target="_blank"
                rel="noreferrer"
                className="aw-panel rounded-lg border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-md font-mono text-sm font-bold"
                    style={{ background: `${magColor(q.mag)}22`, color: magColor(q.mag) }}
                  >
                    {q.mag.toFixed(1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{q.place}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(q.time).toLocaleString()} · depth {q.depth.toFixed(1)} km
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </a>
            ))}
            {quakes.length === 0 && (
              <div className="col-span-full p-6 text-center text-sm text-muted-foreground">
                {quakesQ.isLoading ? "Loading USGS feed…" : "No quakes ≥ 2.5 in the last 24h."}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="aw-panel rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    {a.severity || a.event}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    expires {new Date(a.expires).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium">{a.headline}</div>
                <div className="text-[11px] text-muted-foreground">{a.areaDesc}</div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {alertsQ.isLoading ? "Loading NWS feed…" : "No active Red Flag Warnings."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
