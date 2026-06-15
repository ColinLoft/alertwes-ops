
# Multi-App Architecture + PremierOne Restyle

Split the project into four independent "apps" reachable by direct URL (so operators can pin desktop shortcuts), each with its own toolbar, color theme, and nav. Replace the current single `AppShell` with a per-app shell that mimics the PremierOne / LAFD CAD chrome from the references — gray top chrome, large F-key icon toolbar, per-app accent color, status strip underneath.

## App map

| App | URL | Accent | Contains |
|---|---|---|---|
| **Launcher** | `/` | neutral | Tile grid of the 4 apps + sign-in/role chip |
| **CAD** (wildfire ops) | `/cad/*` | amber/red | Incidents map (current `/incidents`), Cameras, Disaster, Analytics |
| **Dispatch** | `/dispatch/*` | blue | New "Active Calls" board (matches LAFD CAD screenshot), units, cross-agency status, plus drone dispatch panel |
| **Records** | `/records/*` | slate | Reports list, Incident Reports, BOLO board (new), Citations (new) |
| **Flight Ops** | `/flight/*` | cyan | Fleet, Bases, airframes, maintenance |
| Settings | `/settings` | — | Shared, reachable from any app's gear icon |

This is a wildfire-detection / aerial response platform, not a police CAD — Records' BOLO and Citation pages are scaffolds the user can iterate on; the real value is grouping fire reports + incident reports + future records there. Dispatch's "active calls" = active fire incidents in the detection area with assigned drone units.

## Routes (file moves, not rewrites)

```
src/routes/
  index.tsx                  → Launcher (replaces current cameras home)
  cad/
    route.tsx                → CAD shell (Outlet)
    index.tsx                → redirect to /cad/incidents
    incidents.tsx            (moved from /incidents)
    cameras.tsx              (moved from /)
    disaster.tsx             (moved)
    analytics.tsx            (moved)
  dispatch/
    route.tsx                → Dispatch shell
    index.tsx                → Active calls board (new)
    units.tsx                → Signed-in units (new, pulls from drones)
  records/
    route.tsx                → Records shell
    index.tsx                → Reports list (moved from /reports)
    bolo.tsx                 → BOLO scaffold
    citations.tsx            → Citation scaffold
  flight/
    route.tsx                → Flight Ops shell
    index.tsx                → Fleet (moved)
    bases.tsx                (moved)
  settings.tsx               (unchanged path)
  auth.tsx                   (unchanged)
```

Old top-level routes (`/incidents`, `/fleet`, `/bases`, `/reports`, `/disaster`, `/analytics`) keep working via thin redirect route files so existing bookmarks and the `auto_create_incident_report` flow don't break.

## Shared UI: `AppChrome`

New `src/components/AppChrome.tsx` replaces `AppShell` for per-app rendering:

- **Title bar** (gray gradient): app logo + name on left, Live/Profile/Settings/Sign-out on right — matches the LAFD CAD bar.
- **F-key toolbar** (taller, icon-first): each tile shows the F-key label above, a large colored icon, and the page name below. Active tile gets the app's accent color glow.
- **Status strip**: unit/badge on left (e.g. "RA62" or "DRONE-01"), unread/messages/BOLO counters, day/night toggle, availability pill, clock on right. Counters wired to live data where available, placeholders otherwise.
- **Bottom action bar** (where it makes sense per page): Edit / Locate on Map / Create Report / etc. — driven by a per-page `actions` prop.

`AppChrome` takes `{ app, navItems, statusSlot, children }`. Each app's `route.tsx` configures its theme via a `data-app="cad|dispatch|records|flight"` attribute that swaps CSS variable accents defined in `src/styles.css`.

## Launcher (`/`)

Replaces the current camera dashboard at `/`. Renders a 2x2 grid of large app tiles (icon, name, one-line description, live count badge — e.g. CAD shows active incidents, Dispatch shows active calls, Flight shows ready drones). Clicking a tile navigates to that app's root.

## Design tokens (src/styles.css)

Add gray chrome variables and per-app accent variables:

```css
--chrome-bg: linear-gradient(...gray);
--chrome-border: ...;
--app-cad: oklch(...amber);
--app-dispatch: oklch(...blue);
--app-records: oklch(...slate);
--app-flight: oklch(...cyan);
```

Components read `var(--app-accent)` which `[data-app]` overrides.

## New pages (scaffolds)

- **`/dispatch`** — "All Active Calls" table sourced from `incidents` (priority, type, location, assigned drone, action button). "Signed-in Units" pulls from `drones` where `status != offline`. Cross-agency status is a static info card for now (no other agencies wired).
- **`/dispatch/units`** — full unit roster grid.
- **`/records/bolo`** — form + list, persisted to a new `bolos` table.
- **`/records/citations`** — form + list, persisted to a new `citations` table.

## Database (one migration)

```sql
create table public.bolos (id, type text, last_name, first_name, dob,
  race, sex, age, height, weight, plate, vehicle_desc, reason, details,
  issued_by uuid, status text default 'active', created_at, updated_at);
create table public.citations (id, case_no text, violator jsonb,
  vehicle jsonb, violation jsonb, fine_amount, court_date, court_location,
  officer uuid, created_at, updated_at);
```

Both get GRANTs to `authenticated`/`service_role`, RLS enabled, and policies: `authenticated` can read all; only the issuing officer or `admin` can update/delete.

## What stays unchanged

- All data layer (`src/lib/*`), Supabase client, FIRMS/NWS/planes filtering, detection area, approval gate, auth.
- Settings page and admin sections.
- The dark theme remains as the base — the gray chrome sits on top of dark content panels (like the LAFD CAD screenshot).

## Out of scope (call out, don't build)

- Real cross-agency feeds (LAPD/LASD/CHP) — UI placeholders only.
- Per-app keyboard F-key shortcuts wired to the toolbar — visual labels only this pass; can add `useGlobalShortcuts` mapping next.
- Mobile/native shortcuts — operators get URLs they can pin themselves.

## Order of work

1. Migration for `bolos` + `citations`.
2. `AppChrome` + theme tokens.
3. New launcher at `/`.
4. Move existing routes into `/cad/*`, `/flight/*`, `/records/*` with redirects from old paths.
5. New `/dispatch` board + `/records/bolo` + `/records/citations` scaffolds.
6. Update all `<Link>` targets in nav, dispatch panel, incident actions, etc.
