
# Mission Control Restructure

Goal: collapse the multi-page CAD into a single map-first surface where the map is always visible and every workflow (inspect, dispatch, plan, review) happens in floating/docked panels over it.

## New shell layout

```text
┌──────────────────────────────────────────────────────────────┐
│  Top strip (thin, 44px): logo · global search · alerts · user│
├───┬──────────────────────────────────────────────────────┬───┤
│ L │                                                      │ R │
│ e │                                                      │ i │
│ f │              FULL-BLEED LEAFLET MAP                  │ g │
│ t │      (always mounted — never unmounts on route)      │ h │
│   │                                                      │ t │
│ r │   floating: layer manager · tool palette · legend    │   │
│ a │                                                      │ I │
│ i │                                                      │ n │
│ l │                                                      │ s │
├───┴──────────────────────────────────────────────────────┴───┤
│  Bottom dock (collapsible): Live Event Timeline / Feed       │
└──────────────────────────────────────────────────────────────┘
```

- **Left rail (56px, icon-only)**: Incidents, Missions, Units, Cameras, Reports, Analytics, Settings. Click opens a **left drawer** overlaying the map, not a new page. Second click / Esc closes.
- **Right Inspector**: single panel, context switches based on selection (aircraft / camera / hotspot / incident / mission / base). Tabs inside: Overview · Telemetry · History · Actions. Closes to reveal full map.
- **Bottom dock**: Live activity feed (detections, dispatches, launches, status changes, completions). Collapsible to a 28px status bar showing counts + last event.
- **Floating layer manager** (top-right of map): toggles for Aircraft, Cameras, FIRMS, Incidents, Weather, Wind, Airspace, Flight Paths, Red Flag zones, Detection Area, Bases. Grouped, with opacity sliders and per-layer time filters.
- **Floating tool palette** (left of map): Select · Measure · Draw Waypoint · Draw Search Pattern (grid/expanding-square/sector) · Draw Loiter · Pin.

## Routing changes

Keep TanStack routes but treat them as *view state* over the persistent map.

- `/` → redirects to `/map`
- `/map` becomes the shell; map mounts once in the shell component.
- `/map/incidents`, `/map/incidents/$id`, `/map/units`, `/map/units/$id`, `/map/cameras/$id`, `/map/missions/$id`, `/map/reports`, `/map/analytics`, `/map/settings` all render inside the left drawer or right inspector — map stays mounted.
- Legacy `/incidents`, `/dispatch`, `/cameras`, `/fleet`, `/bases`, `/reports`, `/analytics`, `/archive`, `/audit`, `/disaster` redirect into the new structure.

## Contextual inspector (right panel)

One component `<InspectorPanel/>` driven by a Zustand store `useSelection()` holding `{ kind, id }`. Sections rendered per kind:

- **Aircraft**: tail, status, battery, retardant, base, assigned incident, live lat/lng/alt/hdg/spd, flight history (last 10), actions: Recall, Reassign, Mark Maintenance, Follow on map.
- **Camera**: name, status, county, last frame + rolling history strip, mute toggle, health score, confirmed/false-positive counts, actions: Zoom to, Mute 24h, Run AI now, Open playback.
- **FIRMS hotspot**: FRP, confidence, satellite, time, distance to nearest camera/base, actions: Create incident, Dismiss.
- **Incident**: priority, status, source, discovered, assigned drone, quick-note (writes to `incident_events` + optional append to report), timeline, dispatch panel (existing `DispatchPanel`), actions: Change status, False positive, Create mission.
- **Mission**: waypoints list, pattern type, assigned aircraft, ETA/ETE, progress, actions: Launch, Pause, Abort, Edit route.
- **Base**: fleet at base, capacity, actions: Launch from here.

## Live event feed (bottom dock)

Single Supabase Realtime subscription over `incident_events`, `incident_suggestions`, `drones` status changes. Rendered as a virtualized list with type icons, timestamp (relative), and clickable rows that set selection → opens inspector + `flyTo`. Filter chips: Detections · Dispatch · Launches · Status · Completions. Collapse to status bar showing last event + unread badge.

## Layer manager

New `useLayers()` Zustand store (persisted to localStorage). Each existing map layer (`CameraMarkersLayer`, `PlanesLayer`, FIRMS layer, incidents, Red Flag polygons, detection area, weather/wind overlay, bases) reads its `visible`/`opacity` from the store instead of local props. Adds:
- **Wind overlay**: streamlines/particles using existing Open-Meteo point data sampled on a coarse grid over the detection area.
- **Airspace**: static GeoJSON for TFRs and class-B/C rings (stub layer with placeholder toggle).
- **Flight paths**: recent + planned polylines from `drones.last_lat/lng` history and mission waypoints.

## On-map mission planning

New `missions` + `mission_waypoints` tables (migration; RLS + GRANTs per project rules):

```text
missions(id, incident_id?, drone_id?, pattern, status, created_by, created_at, launched_at, completed_at, notes)
mission_waypoints(id, mission_id, seq, lat, lng, alt_ft?, action, loiter_s?)
```

Draw tool flow:
1. Click Waypoint / Pattern / Loiter tool → cursor becomes crosshair.
2. Clicks on map append points; pattern tools open a small floating options popover (spacing, orientation, radius).
3. On finish, a **Mission Draft** card appears in the inspector: name, assign aircraft (ranked with existing `rankCandidates`), ETA/fuel check, Launch button.
4. Launch writes mission + waypoints, updates drone status, emits `incident_event` and shows in feed.
5. Active missions render as polylines on the map; clicking selects the mission.

## Progressive disclosure rules

- Only one left drawer OR one right inspector may be open at a time on narrow viewports (<1200px); both allowed above.
- Floating panels remember collapsed state per user.
- Nothing is modal except destructive confirms (Abort mission, Delete report).
- All chrome uses the existing glass tokens; no new color primitives.

## Migration / cleanup

- Move page bodies from `src/routes/incidents.tsx`, `dispatch.tsx`, `dispatch.units.tsx`, `cameras.tsx`, `fleet.tsx`, `bases.tsx`, `reports.tsx`, `analytics.tsx`, `disaster.tsx`, `archive.tsx`, `audit.tsx`, `settings.tsx` into `src/components/drawers/*` and mount them via the shell.
- Delete `AppChrome` F-key top toolbar; replace with the thin top strip + left rail in a new `MissionShell.tsx`.
- Remove the standalone camera map instance in `cameras.tsx` — cameras page becomes an inspector-driven list drawer.
- Persistent map lives in `MissionShell.tsx` above the `<Outlet />` so route changes never remount it.

## Phased delivery

1. **Shell + persistent map + selection store + inspector skeleton** with Aircraft/Camera/Incident/Hotspot views wired to existing data. Redirect legacy routes.
2. **Layer manager + tool palette + bottom live feed** (feed uses existing Realtime channels).
3. **Missions schema + on-map draw tools + Mission inspector + Launch flow + flight-path layer**.
4. **Wind/airspace overlays, polish, keyboard shortcuts (L=layers, I=inspector, F=feed, Esc=clear selection), and removal of dead pages.**

## Out of scope for this plan
- Real TFR/NOTAM ingestion (airspace layer ships with stub data).
- Video playback beyond the existing camera history strip.
- Multi-operator collaboration cursors.

## Open questions before build
1. Ship all four phases in one pass, or approve phase-by-phase?
2. For mission patterns, which three should ship first — grid, expanding-square, sector, racetrack loiter, point loiter? (Default: grid + expanding-square + point loiter.)
3. Keep the legacy `/incidents`, `/dispatch`, … URLs as redirects, or hard-remove?
