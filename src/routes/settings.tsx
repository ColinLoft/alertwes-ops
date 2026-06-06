import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Crosshair, Flame, Loader2, MapPin, RotateCcw, Trash2 } from "lucide-react";
import { DEFAULT_SETTINGS, useSettings, type Basemap, type Settings } from "@/lib/settings";
import { BASEMAPS } from "@/lib/basemaps";
import { geocode } from "@/lib/geo";
import { fetchCameras } from "@/lib/alertwest";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ALERTWest Map" },
      { name: "description", content: "Configure refresh cadence, marker style, and which cameras to display on the ALERTWest map." },
      { property: "og:title", content: "Settings — ALERTWest Map" },
      { property: "og:description", content: "Configure refresh cadence, marker style, and which cameras to display on the ALERTWest map." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useSettings();
  const { data: cameras = [] } = useQuery({
    queryKey: ["aw-cameras"],
    queryFn: fetchCameras,
    staleTime: 5 * 60_000,
  });

  const { states, counties } = useMemo(() => {
    const s = new Set<string>();
    const c = new Set<string>();
    for (const cam of cameras) {
      if (cam.site.state) s.add(cam.site.state);
      if (cam.site.county) c.add(cam.site.county);
    }
    return { states: [...s].sort(), counties: [...c].sort() };
  }, [cameras]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((p) => ({ ...p, [key]: value }));

  const toggleArr = (key: "states" | "counties", value: string) => {
    setSettings((p) => {
      const has = p[key].includes(value);
      return { ...p, [key]: has ? p[key].filter((v) => v !== value) : [...p[key], value] };
    });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-bold tracking-wide">
                ALERT<span className="text-primary">West</span> Settings
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Map preferences & camera filters
              </div>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to map
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {/* General */}
        <Section title="General" description="How the map behaves while you watch it.">
          <Row label="Auto-refresh interval" hint={`${settings.refreshSeconds}s between automatic data fetches.`}>
            <NumberInput
              value={settings.refreshSeconds}
              min={15}
              max={600}
              step={15}
              suffix="s"
              onChange={(v) => set("refreshSeconds", v)}
            />
          </Row>
          <Row label="Timeline play speed" hint="Delay between frames when timeline playback is on.">
            <NumberInput
              value={settings.playIntervalMs}
              min={250}
              max={10_000}
              step={250}
              suffix="ms"
              onChange={(v) => set("playIntervalMs", v)}
            />
          </Row>
          <Row label="Default map zoom" hint="Initial zoom level (1 world → 18 street).">
            <NumberInput
              value={settings.defaultZoom}
              min={3}
              max={14}
              step={1}
              onChange={(v) => set("defaultZoom", v)}
            />
          </Row>
          <Toggle
            label="Show camera view lines"
            hint="Render the dashed line that indicates where the selected camera is looking."
            checked={settings.showViewLines}
            onChange={(v) => set("showViewLines", v)}
          />
          <Toggle
            label="Pulse animation on live markers"
            hint="Adds a ripple effect on cameras reporting fresh data."
            checked={settings.showMarkerPulse}
            onChange={(v) => set("showMarkerPulse", v)}
          />
          <Toggle
            label="Auto-open the nearest camera"
            hint="After setting a radius below, automatically select the closest camera."
            checked={settings.autoOpenNearest}
            onChange={(v) => set("autoOpenNearest", v)}
          />
        </Section>

        {/* Map & Overlays */}
        <Section title="Map style" description="Pick the basemap and what overlays to show.">
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            {Object.values(BASEMAPS).map((b) => {
              const on = settings.basemap === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => set("basemap", b.id as Basemap)}
                  aria-pressed={on}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    on
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <Toggle
            label="Show place labels"
            hint="Overlay city and road labels on top of the basemap (when supported)."
            checked={settings.showLabels}
            onChange={(v) => set("showLabels", v)}
          />
        </Section>

        {/* Aircraft overlay */}
        <Section title="Aircraft overlay" description="Live planes overhead, sourced from ADS-B / OpenSky.">
          <Toggle
            label="Show planes on the map"
            hint="Render a marker for every aircraft currently in the visible map area."
            checked={settings.showPlanes}
            onChange={(v) => set("showPlanes", v)}
          />
          <Row label="Aircraft refresh interval" hint={`${settings.planesRefreshSeconds}s between aircraft updates (min 10s).`}>
            <NumberInput
              value={settings.planesRefreshSeconds}
              min={10}
              max={300}
              step={5}
              suffix="s"
              onChange={(v) => set("planesRefreshSeconds", v)}
            />
          </Row>
        </Section>

        {/* Planes radius (independent from cameras) */}
        <Section
          title="Planes radius from address"
          description="Optional — only show aircraft within a distance of a place. Independent of the camera radius."
        >
          <RadiusEditor
            settings={settings}
            setSettings={setSettings}
            field="planesRadius"
            placeholder="Airport, city, or address for aircraft"
          />
        </Section>

        {/* Radius */}
        <Section
          title="Radius from address"
          description="Limit cameras to those within a distance of a place. Geocoded via OpenStreetMap."
        >
          <RadiusEditor settings={settings} setSettings={setSettings} />
        </Section>

        {/* States */}
        <Section
          title={`States (${settings.states.length || "all"})`}
          description="Pick one or more states. Leave empty to show every state."
        >
          <ChipGrid
            options={states}
            selected={settings.states}
            onToggle={(v) => toggleArr("states", v)}
            onClear={() => set("states", [])}
            empty="No state data loaded yet."
          />
        </Section>

        {/* Counties */}
        <Section
          title={`Counties (${settings.counties.length || "all"})`}
          description="Narrow further by county. Leave empty to show every county in the chosen states."
        >
          <ChipGrid
            options={counties}
            selected={settings.counties}
            onToggle={(v) => toggleArr("counties", v)}
            onClear={() => set("counties", [])}
            empty="No county data loaded yet."
          />
        </Section>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div>
            <div className="text-sm font-medium">Reset all settings</div>
            <div className="text-xs text-muted-foreground">Restore defaults (CA, 60s refresh, view lines on).</div>
          </div>
          <button
            onClick={() => setSettings(DEFAULT_SETTINGS)}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </main>
    </div>
  );
}

/* ---------- Sections & primitives ---------- */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus-within:ring-2 focus-within:ring-primary">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-20 bg-transparent text-right outline-none"
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          checked ? "border-primary bg-primary" : "border-border bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-background transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function ChipGrid({
  options,
  selected,
  onToggle,
  onClear,
  empty,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  empty: string;
}) {
  if (options.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-muted-foreground">{empty}</div>;
  }
  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              onClick={() => onToggle(o)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                on
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="h-3 w-3" /> Clear selection
        </button>
      )}
    </div>
  );
}

function RadiusEditor({
  settings,
  setSettings,
  field = "radius",
  placeholder = "Address, city, or place name",
}: {
  settings: Settings;
  setSettings: (s: Settings | ((p: Settings) => Settings)) => void;
  field?: "radius" | "planesRadius";
  placeholder?: string;
}) {
  const current = settings[field];
  const [address, setAddress] = useState(current?.address ?? "");
  const [km, setKm] = useState(current?.km ?? 50);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "notfound">("idle");

  const apply = async () => {
    if (!address.trim()) return;
    setStatus("loading");
    try {
      const result = await geocode(address.trim());
      if (!result) {
        setStatus("notfound");
        return;
      }
      setSettings((p) => ({
        ...p,
        [field]: { address: result.display_name, lat: result.lat, lng: result.lng, km },
      }));
      setAddress(result.display_name);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSettings((p) => ({
          ...p,
          [field]: { address: "My current location", lat: pos.coords.latitude, lng: pos.coords.longitude, km },
        }));
        setAddress("My current location");
        setStatus("idle");
      },
      () => setStatus("error"),
      { timeout: 8000 },
    );
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm">
          <input
            type="number"
            min={1}
            max={2000}
            step={1}
            value={km}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) setKm(n);
            }}
            className="w-16 bg-transparent text-right outline-none"
          />
          <span className="text-xs text-muted-foreground">km</span>
        </div>
        <button
          onClick={apply}
          disabled={status === "loading" || !address.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {status === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" />
          )}
          Apply
        </button>
        <button
          onClick={useMyLocation}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Use my location
        </button>
      </div>

      {status === "notfound" && (
        <div className="text-xs text-amber-400">Couldn't find that address. Try another spelling.</div>
      )}
      {status === "error" && (
        <div className="text-xs text-destructive">Lookup failed. Check your connection or try again.</div>
      )}

      {current && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3 text-xs">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-foreground">{current.address}</div>
            <div className="text-muted-foreground">
              {current.lat.toFixed(4)}, {current.lng.toFixed(4)} · within {current.km} km
            </div>
          </div>
          <button
            onClick={() => setSettings((p) => ({ ...p, [field]: null }))}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}
