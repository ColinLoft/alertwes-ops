import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Flame, ShieldOff, VolumeX } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings, type Settings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { AdminSections } from "@/components/AdminSections";
import { useAuth, hasRole } from "@/lib/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aegis CAD" },
      { name: "description", content: "Configure the monitored detection area, branding, and user access." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useSettings();
  const { roles } = useAuth();
  const isAdmin = hasRole(roles, "admin");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((p) => ({ ...p, [k]: v }));

  return (
    <div className="min-h-[calc(100vh-72px)] bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAdmin
                ? "Configure the detection area, brand identity, and approved operators."
                : "Admin-only configuration. Contact an administrator to change the detection area or grant roles."}
            </p>
          </div>
          <Link to="/incidents"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to CAD
          </Link>
        </div>

        {!isAdmin && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
            <ShieldOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              You currently have no admin role. Settings are read-only for non-admins.
            </div>
          </div>
        )}

        {/* Admin: detection area + users (the single area monitored by cameras, planes, and AI) */}
        <AdminSections />

        {isAdmin && <MutedCamerasSection />}

        <BrandingSection settings={settings} set={set} />
      </div>
    </div>
  );
}

function BrandingSection({ settings, set }: { settings: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <section className="rounded-xl border border-white/10 bg-card/30 backdrop-blur-xl">
      <div className="border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-semibold">Branding</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Logo and name shown in the top bar.</p>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-background">
            {settings.logoDataUrl
              ? <img src={settings.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
              : <Flame className="h-7 w-7 text-primary" />}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10">
              Upload logo
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 512 * 1024) { toast.error("Logo must be under 512 KB"); return; }
                  const r = new FileReader();
                  r.onload = () => set("logoDataUrl", String(r.result));
                  r.readAsDataURL(file);
                }} />
            </label>
            {settings.logoDataUrl && (
              <button onClick={() => set("logoDataUrl", null)}
                className="text-[11px] text-muted-foreground hover:text-foreground">Remove logo</button>
            )}
          </div>
        </div>
        <label className="block space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Brand name</div>
          <input type="text" value={settings.brandName}
            onChange={(e) => set("brandName", e.target.value.slice(0, 32))}
            className="w-full sm:w-64 rounded-md border border-white/10 bg-background px-2 py-1.5 text-sm" />
        </label>
      </div>
    </section>
  );
}

interface MutedRow { camera_id: string; camera_name: string | null; reason: string | null; muted_until: string; created_at: string }

function MutedCamerasSection() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery<MutedRow[]>({
    queryKey: ["muted_cameras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("muted_cameras")
        .select("*")
        .gte("muted_until", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MutedRow[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("mc")
      .on("postgres_changes", { event: "*", schema: "public", table: "muted_cameras" },
        () => qc.invalidateQueries({ queryKey: ["muted_cameras"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const unmute = async (id: string) => {
    const { error } = await supabase.from("muted_cameras").delete().eq("camera_id", id);
    if (error) toast.error(error.message); else toast.success("Camera un-muted");
  };

  return (
    <section className="rounded-xl border border-white/10 bg-card/30 backdrop-blur-xl">
      <div className="border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <VolumeX className="h-3.5 w-3.5 text-amber-400" /> Muted cameras
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cameras here are excluded from AI sweeps. Use this when a camera produces repeated false positives (dirty lens, persistent glare, fog).
        </p>
      </div>
      <div className="p-2">
        {rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">No muted cameras.</div>
        ) : (
          <table className="cad-table">
            <thead><tr><th>Camera</th><th>Reason</th><th>Until</th><th className="text-right">Action</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.camera_id}>
                  <td className="text-foreground">{r.camera_name ?? r.camera_id}</td>
                  <td className="text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="font-mono text-[10.5px] text-muted-foreground">{new Date(r.muted_until).toLocaleString()}</td>
                  <td className="text-right">
                    <button onClick={() => unmute(r.camera_id)}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] hover:bg-white/10">
                      Un-mute
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
