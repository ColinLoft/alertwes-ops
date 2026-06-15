import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertOctagon, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/bolo")({
  head: () => ({ meta: [{ title: "BOLO — Aegis Records" }] }),
  component: BoloPage,
  ssr: false,
});

interface BoloRow {
  id: string; bolo_type: string; first_name: string | null; last_name: string | null;
  dob: string | null; race: string | null; sex: string | null; age: number | null;
  height: string | null; weight: string | null; plate: string | null; vehicle_desc: string | null;
  reason: string | null; details: string | null; status: string; created_at: string;
}

async function fetchBolos(): Promise<BoloRow[]> {
  const { data, error } = await supabase.from("bolos" as any).select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as BoloRow[];
}

function BoloPage() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  const { data: bolos = [] } = useQuery({ queryKey: ["bolos"], queryFn: fetchBolos, refetchInterval: 30_000 });
  const [form, setForm] = useState({
    bolo_type: "person", first_name: "", last_name: "", dob: "", race: "", sex: "", age: "",
    height: "", weight: "", plate: "", vehicle_desc: "", reason: "", details: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return toast.error("Sign in required");
    if (!form.reason.trim()) return toast.error("Reason required");
    const payload: any = { ...form, issued_by: userId, age: form.age ? Number(form.age) : null, dob: form.dob || null };
    const { error } = await supabase.from("bolos" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("BOLO issued");
    setForm({ bolo_type: "person", first_name: "", last_name: "", dob: "", race: "", sex: "", age: "", height: "", weight: "", plate: "", vehicle_desc: "", reason: "", details: "" });
    qc.invalidateQueries({ queryKey: ["bolos"] });
  }

  async function clear(id: string) {
    const { error } = await supabase.from("bolos" as any).update({ status: "cleared" }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bolos"] });
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[1fr_1.2fr]">
      {/* Issue form */}
      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-amber-400" />
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em]">Issue New BOLO</h2>
        </div>
        <div className="mb-3 flex gap-1.5">
          {(["person", "vehicle"] as const).map((t) => (
            <button key={t} onClick={() => setForm((f) => ({ ...f, bolo_type: t }))}
              className={`rounded border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${form.bolo_type === t ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-muted-foreground hover:bg-white/5"}`}>{t}</button>
          ))}
        </div>
        <form onSubmit={submit} className="grid grid-cols-2 gap-2 text-[11px]">
          {form.bolo_type === "person" ? (
            <>
              <Field label="Last Name" value={form.last_name} onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} />
              <Field label="First Name" value={form.first_name} onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} />
              <Field label="DOB" type="date" value={form.dob} onChange={(v) => setForm((f) => ({ ...f, dob: v }))} />
              <Field label="Race" value={form.race} onChange={(v) => setForm((f) => ({ ...f, race: v }))} />
              <Field label="Sex" value={form.sex} onChange={(v) => setForm((f) => ({ ...f, sex: v }))} />
              <Field label="Age" value={form.age} onChange={(v) => setForm((f) => ({ ...f, age: v }))} />
              <Field label="Height" value={form.height} onChange={(v) => setForm((f) => ({ ...f, height: v }))} />
              <Field label="Weight" value={form.weight} onChange={(v) => setForm((f) => ({ ...f, weight: v }))} />
            </>
          ) : (
            <>
              <Field label="Plate #" value={form.plate} onChange={(v) => setForm((f) => ({ ...f, plate: v }))} />
              <Field label="Vehicle Description" value={form.vehicle_desc} onChange={(v) => setForm((f) => ({ ...f, vehicle_desc: v }))} />
            </>
          )}
          <div className="col-span-2">
            <Field label="Reason / Offense" value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} placeholder="e.g. STOLEN VEHICLE (PC 10851)" />
          </div>
          <div className="col-span-2">
            <label className="block text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">Additional Details</label>
            <textarea value={form.details} onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))} rows={3}
              className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[12px]" placeholder="Last seen direction, clothing, weapon description..." />
          </div>
          <button type="submit" className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded bg-red-600 px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-white hover:bg-red-500">
            <AlertOctagon className="h-4 w-4" /> Issue BOLO
          </button>
        </form>
      </section>

      {/* Active list */}
      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em]">Active BOLOs ({bolos.filter((b) => b.status === "active").length})</h2>
        <div className="space-y-2">
          {bolos.length === 0 && <div className="rounded border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">No BOLOs issued.</div>}
          {bolos.map((b) => (
            <div key={b.id} className={`rounded border p-3 ${b.status === "active" ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-white/[0.02] opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9.5px] font-black tracking-wider text-white">{b.bolo_type.toUpperCase()}</span>
                    <span className="text-[13px] font-bold">{b.bolo_type === "person" ? `${b.last_name ?? "?"}, ${b.first_name ?? "?"}` : b.plate || "?"}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-foreground/85">{b.reason}</div>
                  {b.details && <div className="mt-1 text-[11px] text-muted-foreground">{b.details}</div>}
                </div>
                {b.status === "active" && (
                  <button onClick={() => clear(b.id)} className="rounded border border-white/10 px-2 py-1 text-[10px] font-bold uppercase hover:bg-white/5">Clear</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[12px]" />
    </div>
  );
}
