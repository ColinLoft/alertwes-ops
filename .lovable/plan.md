# Aegis Command — Wildfire UAV Operations Center

Repurpose the current AlertWest viewer into a CAD-style command center for your fixed-wing wildfire-suppression UAV company. Modern transparent/glass UI on top of a near-black tactical canvas, using your existing custom logo + theme colors. Build order matches your priority list.

## App shell (built once, used by all phases)

- Collapsible left **rail nav** (icon-only collapsed) using shadcn Sidebar: Dispatch · Fleet · Incidents · Bases · Disaster Response · Ops · Admin.
- Top **status bar**: brand/logo, global incident counters (Active / Dispatched / Confirmed), system clock (local + UTC/Zulu), connection health pills (AlertWest, FIRMS, NWS, OpenSky, NOTAMs), signed-in user + role chip.
- Right-side **context drawer** that any module can push panels into (selected incident, selected drone, mission log).
- Global **command palette** (Ctrl/Cmd-K) for search across drones, incidents, bases, people.
- Audio + toast **alert system** for new incidents, drone state changes, geofence breaches.
- Reuses your existing transparent `.aw-popup` glass style; we add `.aw-panel`, `.aw-rail`, `.aw-statbar`, `.aw-chip` matching tokens, all driven by user-customizable `--primary` / `--accent`.

## Phase 1 — Drone Fleet Ops (first)

Goal: see every drone, where it is, what it's doing, before any incident logic runs.

- **Fleet roster table + grid view**: tail number, model, base, status (Ready / Pre-flight / In-flight / Returning / Charging / Maintenance / Offline), battery %, payload (retardant L remaining), flight hours, last mission, next service.
- **Live map layer** on the main map: drone icons with heading arrow, status color, range ring (80–100 mi configurable per airframe), selected drone shows planned route + ground track.
- **Drone detail drawer**: telemetry placeholder (alt, GS, HDG, batt, link), payload, mission history, maintenance log link, manual command stubs (RTB, Loiter, Abort — disabled with "requires pilot link" tooltip for now).
- **Base stations module**: each base = pin on map with hangar capacity, drones docked, refuel/recharge slots, weather snapshot. Fresno HQ seeded.
- **Crew on shift** strip: who's dispatcher / pilot today.

## Phase 2 — Incident CAD board

Goal: live wildfire feed → triage → assign drone → track mission.

- **Incidents queue** (CAD-style left rail list): priority color, time since detected, source (AlertWest cam / FIRMS hotspot / NWS / manual), county, distance from nearest base, status (New → Triage → Confirmed → Dispatched → On-scene → Suppressed → Closed → False alarm).
- **Map overlays**:
  - AlertWest cameras (existing).
  - NASA FIRMS VIIRS/MODIS hotspots (last 24 h, color by confidence + age).
  - NWS Red Flag warning polygons (filled, transparent).
  - FAA NOTAM / TFR polygons (red hatched — flight prohibited).
  - Selected incident: spider lines to nearest cameras, candidate drones, candidate bases.
- **Incident detail panel** (right drawer): coordinates, county/state, detection source(s), confidence, timeline/audit log, attached camera frames/FIRMS pixels, **Synoptic wind block** (speed, dir, gusts at incident lat/lng, updated every minute while open), nearest fire agency contact, status workflow buttons, "Assign drone" launches Phase 3 picker.
- **Audit log** persisted per incident: every state change, who did it, when.

## Phase 3 — Dispatch engine

Goal: autonomous drone selection for a confirmed incident within range.

- Match algorithm (server function): filter drones by `status == Ready` AND `distance(base, incident) ≤ airframe.range_mi - safety_margin` AND `payload_full` AND `no overlapping NOTAM between base and incident`; rank by ETA (distance / cruise speed) then battery/payload health.
- **Auto-dispatch toggle** per incident class (e.g. auto-dispatch FIRMS high-confidence + AlertWest-confirmed; manual only for single-source).
- **Dispatch modal**: shows top 3 candidates with ETA, range margin, weather, NOTAM check; dispatcher confirms or overrides.
- Creates a **Mission** record: drone, incident, dispatcher, launch ETA, planned route, status (Queued / Launched / Transit / On-scene / RTB / Complete).
- Mission ribbon on map: drone icon animates along planned bearing (placeholder until real telemetry exists).

## Phase 4 — Company Ops shells (stubs only)

Navigation entries + empty/CRUD-light pages so the structure exists:

- **Maintenance** — list per airframe, scheduled vs unscheduled, "log entry" form.
- **Production** — kanban of airframes in build, stage, target completion.
- **Support tickets** — basic table, status, assignee.
- **Personnel** — users + roles, on-call schedule placeholder.
- **Disaster Response tab** — USGS earthquakes + active NWS alerts overlaid on map; "deploy fleet for ISR" workflow that reuses dispatch engine without retardant requirement.

## Data sources

| Source | Use | Cost | How |
|---|---|---|---|
| AlertWest (existing) | Camera-based confirmation | Free | Already wired |
| NASA FIRMS | Hotspot detections (VIIRS/MODIS), 3-h latency | Free, requires free MAP_KEY | Server function pulls area CSV every 15 min |
| NWS api.weather.gov | Red Flag warnings, active alerts | Free, no key | Server function |
| Synoptic Data | On-demand wind/gust at incident | Free tier w/ token | Server fn on incident select |
| FAA NOTAMs / TFRs | Airspace check before dispatch | Free public feed | Server fn, cached 5 min |
| OpenSky (existing) | Manned aircraft deconfliction near drone routes | Free | Already wired |
| USGS earthquakes | Disaster response tab | Free, no key | Server fn |

Two secrets needed before we start: `FIRMS_MAP_KEY`, `SYNOPTIC_TOKEN`. I'll ask for them at the top of Phase 2.

## Auth & roles (built up front, before Phase 1 data writes)

Roles via the standard `app_role` enum + `user_roles` table + `has_role()` SECURITY DEFINER function (per your knowledge rules):

- **Admin** — everything, manages users/roles, branding.
- **Dispatcher** — incidents, dispatch, mission control.
- **Pilot** — fleet + assigned missions, manual command stubs.
- **Maintenance** — fleet read, maintenance write.

Auth page already exists. Add role-gated routes via `_authenticated/` layout; per-role module visibility in the sidebar. Branding (logo, primary, accent) already persists per-user — kept.

## Technical notes (for me, skip if not interested)

- TanStack Start server functions (`createServerFn` + `requireSupabaseAuth`) for all data feeds; raw HTTP server routes only for any future webhook (e.g. drone telemetry POST).
- Tables: `airframes`, `bases`, `drones`, `incidents`, `incident_events` (audit), `missions`, `mission_events`, `maintenance_logs`, `tickets`, `app_role`, `user_roles`. RLS scoped by role via `has_role()`.
- Realtime: enable `supabase_realtime` on `drones`, `incidents`, `missions` so all consoles update live.
- Map: keep Leaflet + canvas renderer; add layer groups per data source with a layer-toggle panel; reuse existing throttling + memoized icons; new drone/FIRMS/NOTAM icons follow the same `.aw-hit` 40 px hit-target pattern.
- Performance: server fns cache external feeds in-memory per worker for short TTLs (15 s OpenSky, 60 s NWS, 5 min NOTAM, 15 min FIRMS) to stay under provider limits.

## Deliverable order in chat

1. App shell + sidebar + roles + DB schema + Phase 1 (fleet UI with seeded Fresno HQ + a few demo drones).
2. Phase 2 (incidents + FIRMS + NWS + Red Flag + Synoptic wind on select + NOTAM overlay) — I'll ask for the two API keys at the start.
3. Phase 3 (dispatch engine + missions).
4. Phase 4 (ops shells + disaster tab).

After approval I'll start with step 1.