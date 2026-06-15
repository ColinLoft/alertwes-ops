import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/citations")({
  head: () => ({ meta: [{ title: "Citations — Aegis Records" }] }),
  component: CitationsPage,
  ssr: false,
});

interface CitationRow {
  id: string; case_no: string | null;
  violator: any; vehicle: any; violation: any;
  fine_amount: number | null; court_date: string | null; court_location: string | null;
  created_at: string;
}

async function fetchCitations(): Promise<CitationRow[]> {
  const { data, error } = await supabase.from("citations" as any).select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as CitationRow[];
}

function CitationsPage() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const { data: rows = [] } = useQuery({ queryKey: ["citations"], queryFn: fetchCitations, refetchInterval: 30_000 });
  const [f, setF] = useState({
    last_name: "", first_name: "", dob: "", license: "", state: "CA", address: "",
    plate: "", vehicle_state: "CA", year: "", make: "", model: "", color: "",
    code: "", description: "", speed: "", location: "", date: "", time: "",
    fine: "", court_date: "", court_location: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return toast.error("Sign in required");
    if (!f.code && !f.description) return toast.error("Violation code or description required");
    const payload: any = {
      case_no: `AEGIS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`,
      violator: { last_name: f.last_name, first_name: f.first_name, dob: f.dob || null, license: f.license, state: f.state, address: f.address },
      vehicle: { plate: f.plate, state: f.vehicle_state, year: f.year, make: f.make, model: f.model, color: f.color },
      violation: { code: f.code, description: f.description, speed: f.speed, location: f.location, date: f.date || null, time: f.time || null },
      fine_amount: f.fine ? Number(f.fine) : null,
      court_date: f.court_date || null, court_location: f.court_location,
      officer: userId,
    };
    const { error } = await supabase.from("citations" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(`Citation ${payload.case_no} issued`);
    setF({ last_name: "", first_name: "", dob: "", license: "", state: "CA", address: "", plate: "", vehicle_state: "CA", year: "", make: "", model: "", color: "", code: "", description: "", speed: "", location: "", date: "", time: "", fine: "", court_date: "", court_location: "" });
    qc.invalidateQueries({ queryKey: ["citations"] });
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h1 className="text-[14px] font-bold uppercase tracking-[0.14em]">Traffic Citation</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Block title="Violator Information">
            <Field label="Last Name" v={f.last_name} on={(v) => setF({ ...f, last_name: v })} />
            <Field label="First Name" v={f.first_name} on={(v) => setF({ ...f, first_name: v })} />
            <Field label="DOB" type="date" v={f.dob} on={(v) => setF({ ...f, dob: v })} />
            <Field label="Driver License #" v={f.license} on={(v) => setF({ ...f, license: v })} />
            <Field label="State" v={f.state} on={(v) => setF({ ...f, state: v })} />
            <Field label="Address" v={f.address} on={(v) => setF({ ...f, address: v })} className="sm:col-span-3" />
          </Block>

          <Block title="Vehicle">
            <Field label="Plate #" v={f.plate} on={(v) => setF({ ...f, plate: v })} />
            <Field label="State" v={f.vehicle_state} on={(v) => setF({ ...f, vehicle_state: v })} />
            <Field label="Year" v={f.year} on={(v) => setF({ ...f, year: v })} />
            <Field label="Make" v={f.make} on={(v) => setF({ ...f, make: v })} />
            <Field label="Model" v={f.model} on={(v) => setF({ ...f, model: v })} />
            <Field label="Color" v={f.color} on={(v) => setF({ ...f, color: v })} />
          </Block>

          <Block title="Violation">
            <Field label="Penal / Vehicle Code" v={f.code} on={(v) => setF({ ...f, code: v })} placeholder="e.g. CVC 22350" />
            <Field label="Violation Description" v={f.description} on={(v) => setF({ ...f, description: v })} placeholder="e.g. Speeding" />
            <Field label="Speed / Detail" v={f.speed} on={(v) => setF({ ...f, speed: v })} placeholder="e.g. 85 in 65 MPH zone" />
            <Field label="Location of Stop" v={f.location} on={(v) => setF({ ...f, location: v })} className="sm:col-span-2" />
            <Field label="Date of Stop" type="date" v={f.date} on={(v) => setF({ ...f, date: v })} />
            <Field label="Time of Stop" type="time" v={f.time} on={(v) => setF({ ...f, time: v })} />
          </Block>

          <Block title="Fine & Court">
            <Field label="Fine Amount" v={f.fine} on={(v) => setF({ ...f, fine: v })} placeholder="$" />
            <Field label="Court Date" type="date" v={f.court_date} on={(v) => setF({ ...f, court_date: v })} />
            <Field label="Court Location" v={f.court_location} on={(v) => setF({ ...f, court_location: v })} />
          </Block>

          <button type="submit" className="w-full rounded bg-primary px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
            Issue Citation
          </button>
        </form>

        <h2 className="mt-8 mb-2 text-[12px] font-bold uppercase tracking-[0.14em]">Recent Citations ({rows.length})</h2>
        <div className="space-y-1.5">
          {rows.map((c) => (
            <div key={c.id} className="rounded border border-white/10 bg-white/[0.02] p-2.5 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-primary">{c.case_no}</span>
                <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-foreground/85">
                {c.violator?.last_name}, {c.violator?.first_name} · {c.violation?.code} {c.violation?.description}
                {c.fine_amount != null && <span className="ml-2 text-emerald-300">${c.fine_amount}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-white/10 bg-white/[0.02]">
      <legend className="ml-3 rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/90">{title}</legend>
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}
function Field({ label, v, on, type = "text", placeholder, className = "" }: { label: string; v: string; on: (v: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[12px]" />
    </div>
  );
}
