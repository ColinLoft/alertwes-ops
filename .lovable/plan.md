## Goal

Re-shape Aegis Command into a focused **fire detection + operations CAD**: Spillman-style dense tables in a translucent iOS-glass shell, with cameras as the primary detection source, an AI-assisted triage queue, and admin-controlled access + area scoping.

---

## 1. Pages & navigation

Top bar items become: **Incidents (CAD)** · **Cameras** · **Fleet** · **Bases** · **Disaster** · **Settings**

- **Remove** `/ops/maintenance` and `/ops/personnel` (delete route files; drop from nav).
- **Remove** standalone `/admin` route; fold its panels into Settings as gated tabs.
- `/incidents` becomes the primary landing / CAD view.

## 2. Approval gate

New table `user_profiles(user_id, status: 'pending'|'approved'|'denied', display_name, ...)` with a trigger that creates a row on signup with `status='pending'`. RLS: user reads own row, admins read/update all.

App shell behavior: signed-in but not approved → render a "Pending approval" screen instead of the app. Admins can approve + assign role in Settings → Users.

`claim_first_admin()` will also auto-approve the caller.

## 3. Settings (admin-gated tabs)

`/settings` becomes the single config surface:

- **Profile** — anyone signed in
- **Branding** — anyone signed in (existing)
- **Detection area** — admin only
- **Users & roles** — admin only (current `/admin` content + approve/deny)
- **System** — admin only (clear caches, dev seeds)

Non-admin tabs simply don't render.

## 4. Detection area (new)

New table `detection_area` (singleton, one row):
- `center_lat`, `center_lng`, `radius_mi` (number)
- `states text[]` (e.g. `{CA,OR}`)
- `counties text[]` (e.g. `{Los Angeles,Ventura}`)

A camera/hotspot qualifies for incident creation if **either** (a) it falls within `radius_mi` of the center **or** (b) its `state`/`county` is in the lists. Empty area = nothing qualifies (safety default).

Helper `isInDetectionArea(lat,lng,state,county, area)` used by:
- camera list (badge + enable/disable "Report" button)
- FIRMS hotspot click-to-create
- AI suggestion ingestion

## 5. Camera-first detection (AI suggest + operator confirm)

New table `incident_suggestions`:
- `source` ('camera'|'firms'), `camera_id`, `lat`, `lng`, `state`, `county`
- `confidence smallint`, `label` ('smoke'|'fire'|'clear'), `reasoning text`
- `image_url`, `image_time`, `status` ('pending'|'promoted'|'dismissed')
- Realtime enabled.

**Server function** `analyzeCameraFrame` (Lovable AI Gateway, `google/gemini-2.5-flash-image` for vision or `gemini-3-flash-preview` with image input) — given a camera image URL + metadata, returns `{ label, confidence, reasoning }`. Throttled 1 frame / camera / 5 min, only for cameras inside the detection area. Writes to `incident_suggestions` when `confidence ≥ 60` and label ≠ clear.

**Triage strip** in the Incidents CAD view shows pending suggestions with thumbnail + AI reasoning. Operator clicks **Promote** → creates an `incident` (linked back via `external_id = suggestion.id`) or **Dismiss**.

A "Run AI sweep" button in the Cameras page kicks an on-demand pass across in-area cameras (batched, returns count of new suggestions). Scheduled polling can be added later.

## 6. CAD-style UI (Spillman-inspired, iOS glass)

Layout for `/incidents`:

```text
┌────────────── Top bar (existing, glassified) ──────────────┐
├─ AI Triage strip (horizontal cards, dismissible)           ┤
├─ Active Incidents table (dense, color-coded by status)     ┤
│   Call# | Nature | Location | County | Pr | Status | Time | Unit
├─ Split below: [ Map (left) ] | [ Unit roster table (right) ]┤
└─────────────────────────────────────────────────────────────┘
```

- Tables: monospaced numerals, 11–12px, row hover, status color in the leftmost cell (red P1 fire / amber medical-of-fire / cyan contained / etc.).
- All surfaces use a new `--glass-*` token set: `backdrop-blur-xl`, `bg-white/[0.04]`, `border-white/10`, subtle inner highlight. No flat panels.
- Unit roster table mirrors the lower table in the screenshot — drones with Status / Time-in-status / Call# / Base / Description.
- Status changes + dispatch actions update both tables in real time (already on realtime).

## 7. Detection-area enforcement

- `createIncidentFromHotspot` and the new `promoteSuggestion` RPCs check the area; reject with toast if outside.
- DB-side `BEFORE INSERT` trigger on `incidents` also enforces area (defense in depth) — admins can bypass with `bypass_area=true` payload via a manual-create flow.

---

## Technical notes (for the dev side)

- New migration: `user_profiles`, signup trigger, `detection_area` singleton + seed row, `incident_suggestions`, area-check trigger on `incidents`, realtime add for both new tables.
- New server fns: `analyzeCameraFrame`, `sweepCameras`, `promoteSuggestion` (all `requireSupabaseAuth`).
- New libs: `src/lib/area.ts` (geo + state/county check), `src/lib/suggestions.ts` (CRUD).
- New components: `ApprovalGate`, `TriageStrip`, `IncidentsTable`, `UnitRosterTable`, `GlassPanel`.
- Style tokens added in `src/styles.css` (`--glass-bg`, `--glass-border`, `--glass-highlight`, P1–P4 colors, status colors).
- Delete: `src/routes/ops.maintenance.tsx`, `src/routes/ops.personnel.tsx`, `src/routes/admin.tsx` (its content moves into `settings.tsx`).
- Keep existing fleet/bases/disaster routes; restyle headers to the glass shell but no structural change.
- `LOVABLE_API_KEY` already present; no new secrets.

I'll execute in this order: migration → approval gate + settings merge → remove old pages → glass tokens + CAD layout → detection area + enforcement → AI suggestion pipeline + triage strip.