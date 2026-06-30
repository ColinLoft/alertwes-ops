import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Log — Aegis Records" }] }),
  component: AuditPage,
  ssr: false,
});

async function fetchAudit() {
  const { data, error } = await supabase
    .from("incident_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

function AuditPage() {
  const { data: events = [] } = useQuery({ queryKey: ["audit_log"], queryFn: fetchAudit, refetchInterval: 30_000 });
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/10">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/90">Audit Log</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">({events.length})</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="cad-table">
          <thead>
            <tr><th>Time</th><th>Incident</th><th>Type</th><th>Message</th></tr>
          </thead>
          <tbody>
            {events.map((e: any) => (
              <tr key={e.id}>
                <td className="font-mono text-[10.5px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                <td className="font-mono text-primary">{String(e.incident_id ?? "").slice(0, 8).toUpperCase()}</td>
                <td className="text-[11px] uppercase tracking-wider">{e.event_type}</td>
                <td className="text-[11.5px]">{e.message ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
