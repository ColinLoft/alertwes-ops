## Fix Open-Meteo 429 on On-Scene Weather

**Problem**: `getWindAtPoint` hits Open-Meteo on every incident view/refetch. Open-Meteo's free tier throttles per-IP; from a shared Worker egress we're getting `429 Too Many Requests`, which surfaces as "No data: Open-Meteo 429".

**Fix** (edit only `src/lib/synoptic.functions.ts`):

1. **Round coordinates** to ~0.1° (≈7mi) so nearby incidents share a cache key.
2. **In-memory TTL cache** (module-scope `Map`) keyed by rounded lat/lng, 10-minute TTL. Serve cached obs on 429/network errors even if slightly stale (up to 1h).
3. **Retry once** on 429 after ~800ms with jitter before falling back to cache.
4. **Graceful message**: when no cache and upstream 429s, return `{ obs: null, error: "Weather service busy — retrying shortly" }` instead of surfacing the raw status code.
5. **Client side** (`CameraPanel` / wherever `getWindAtPoint` is called): bump react-query `staleTime` to 10 min and disable refetch-on-focus for this query so we stop hammering the endpoint. I'll grep for call sites and adjust just the query options — no behavior change beyond cadence.

No schema changes, no new deps, no other files touched.
