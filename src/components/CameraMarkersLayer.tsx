import { useMemo, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { getStatus, parseViewLine, type Camera } from "@/lib/alertwest";
import { bearingDeg } from "@/lib/geo";

function makeIcon(color: string, active: boolean, pulse: boolean, label: string, headingDeg: number | null, badge: number) {
  const safe = label.replace(/"/g, "&quot;");
  const rot = headingDeg ?? 0;
  const svg = `
    <svg viewBox="0 0 24 24" width="22" height="22" style="transform: rotate(${rot}deg); transform-origin: 50% 50%;" aria-hidden="true">
      <path fill="currentColor" stroke="rgba(0,0,0,0.55)" stroke-width="0.8" stroke-linejoin="round"
        d="M12 2.2l8.4 16.6c.35.7-.4 1.46-1.12 1.13L12 16.6 4.72 19.93c-.73.33-1.47-.43-1.12-1.13L12 2.2z"/>
      <circle cx="12" cy="14.5" r="2.3" fill="rgba(0,0,0,0.45)"/>
    </svg>`;
  const badgeHtml =
    badge > 1
      ? `<span class="aw-badge" aria-label="${badge} cameras here">${badge}</span>`
      : "";
  return L.divIcon({
    className: "",
    html: `<div class="aw-marker${active ? " aw-active" : ""}${pulse ? " aw-pulse" : ""}" style="--mc:${color}" role="button" tabindex="0" aria-label="${safe}">${svg}${badgeHtml}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const CELL_PX = 24;

export function CameraMarkersLayer({
  cameras,
  selectedId,
  onSelect,
  showPulse,
}: {
  cameras: Camera[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showPulse: boolean;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [picker, setPicker] = useState<{ pos: [number, number]; group: Camera[] } | null>(null);

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  // group cameras by pixel cell at current zoom
  const groupByCamId = useMemo(() => {
    const cells = new Map<string, Camera[]>();
    const camToKey = new Map<string, string>();
    for (const c of cameras) {
      const lat = Number(c.site.latitude);
      const lng = Number(c.site.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const pt = map.project([lat, lng], zoom);
      const key = `${Math.round(pt.x / CELL_PX)}:${Math.round(pt.y / CELL_PX)}`;
      const arr = cells.get(key) ?? [];
      arr.push(c);
      cells.set(key, arr);
      camToKey.set(c.site.id, key);
    }
    const groupOf = new Map<string, Camera[]>();
    for (const c of cameras) {
      const k = camToKey.get(c.site.id);
      if (k) groupOf.set(c.site.id, cells.get(k) ?? [c]);
    }
    return groupOf;
  }, [cameras, zoom, map]);

  return (
    <>
      {cameras.map((c) => {
        const lat = Number(c.site.latitude);
        const lng = Number(c.site.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const active = selectedId === c.site.id;
        const s = getStatus(c);
        const group = groupByCamId.get(c.site.id) ?? [c];
        const label = `${c.name}${c.site.county || c.site.state ? ` — ${[c.site.county, c.site.state].filter(Boolean).join(", ")}` : ""} (${s.label})`;
        const vl = parseViewLine(c.view.line);
        const heading =
          vl && vl.length >= 2
            ? bearingDeg({ lat: vl[0][0], lng: vl[0][1] }, { lat: vl[vl.length - 1][0], lng: vl[vl.length - 1][1] })
            : null;
        return (
          <Marker
            key={c.site.id}
            position={[lat, lng]}
            icon={makeIcon(s.color, active, showPulse && s.status === "online", label, heading, group.length)}
            keyboard
            alt={label}
            title={label}
            eventHandlers={{
              click: () => {
                if (group.length > 1) {
                  // Open the picker centered on the average of the group so users see all options.
                  const avgLat = group.reduce((sum, g) => sum + Number(g.site.latitude), 0) / group.length;
                  const avgLng = group.reduce((sum, g) => sum + Number(g.site.longitude), 0) / group.length;
                  setPicker({ pos: [avgLat, avgLng], group });
                } else {
                  onSelect(c.site.id);
                }
              },
            }}
          />
        );
      })}

      {picker && (
        <Popup
          position={picker.pos}
          eventHandlers={{ remove: () => setPicker(null) }}
        >
          <div className="min-w-[220px]">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {picker.group.length} cameras here
            </div>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto">
              {picker.group
                .slice()
                .sort((a, b) => (getStatus(a).ageMs ?? Infinity) - (getStatus(b).ageMs ?? Infinity))
                .map((c) => {
                  const s = getStatus(c);
                  return (
                    <li key={c.site.id}>
                      <button
                        onClick={() => {
                          onSelect(c.site.id);
                          setPicker(null);
                          map.closePopup();
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/10"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: s.color }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">{c.name}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {[c.site.county, c.site.state].filter(Boolean).join(", ") || "—"} · {s.label}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        </Popup>
      )}
    </>
  );
}
