import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchIncidents, PRIORITY_META, STATUS_META } from "@/lib/incidents";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/archive")({
  head: () => ({ meta: [{ title: "Archive — Aegis Records" }] }),
  component: ArchivePage,
  ssr: false,
});

function ArchivePage() {
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents"], queryFn: fetchIncidents });
  const closed = incidents.filter((i) => ["closed", "false_positive"].includes(i.status));
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/10">
        <Archive className="h-4 w-4 text-primary" />
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground/90">Closed Incident Archive</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">({closed.length})</span>
      </div>
      <div className="flex-1 overflow-auto">
        {closed.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No archived incidents.</div>
        ) : (
          <table className="cad-table">
            <thead>
              <tr><th>ID</th><th>Pri</th><th>Title</th><th>County</th><th>Status</th><th>Closed</th></tr>
            </thead>
            <tbody>
              {closed.map((i) => {
                const pri = PRIORITY_META[i.priority];
                const st = STATUS_META[i.status];
                return (
                  <tr key={i.id}>
                    <td><Link to="/incidents" className="font-mono font-bold text-primary">{i.id.slice(0, 8).toUpperCase()}</Link></td>
                    <td><span className="rounded px-1.5 py-0.5 text-[10px] font-black" style={{ background: `${pri.color}22`, color: pri.color }}>{pri.label}</span></td>
                    <td>{i.title}</td>
                    <td>{i.county ?? "—"}</td>
                    <td><span style={{ color: st.color }} className="text-[11px] font-semibold">{st.label}</span></td>
                    <td className="font-mono text-[10.5px] text-muted-foreground">{new Date(i.updated_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
