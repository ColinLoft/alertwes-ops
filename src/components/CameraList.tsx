import { useMemo, useState } from "react";
import { Search, MapPin, Clock, Signal } from "lucide-react";
import { getStatus, relTime, type Camera } from "@/lib/alertwest";

type SortKey = "name" | "status" | "updated" | "location";

export function CameraList({
  cameras,
  selectedId,
  onSelect,
}: {
  cameras: Camera[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "stale" | "offline">("all");
  const [sort, setSort] = useState<SortKey>("status");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = cameras
      .map((c) => ({ c, s: getStatus(c) }))
      .filter(({ c, s }) => {
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.source.toLowerCase().includes(q) ||
          (c.site.county ?? "").toLowerCase().includes(q) ||
          (c.site.state ?? "").toLowerCase().includes(q)
        );
      });

    const rank: Record<string, number> = { online: 0, stale: 1, unknown: 2, offline: 3 };
    filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.c.name.localeCompare(b.c.name);
        case "updated":
          return (a.s.ageMs ?? Infinity) - (b.s.ageMs ?? Infinity);
        case "location":
          return (
            (a.c.site.state ?? "").localeCompare(b.c.site.state ?? "") ||
            (a.c.site.county ?? "").localeCompare(b.c.site.county ?? "")
          );
        case "status":
        default:
          return (
            (rank[a.s.status] ?? 99) - (rank[b.s.status] ?? 99) ||
            (a.s.ageMs ?? Infinity) - (b.s.ageMs ?? Infinity)
          );
      }
    });
    return filtered;
  }, [cameras, query, statusFilter, sort]);

  const counts = useMemo(() => {
    const c = { online: 0, stale: 0, offline: 0, unknown: 0 } as Record<string, number>;
    for (const cam of cameras) c[getStatus(cam).status]++;
    return c;
  }, [cameras]);

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className="border-b border-border bg-card/60 px-4 pb-3 pt-20 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cameras by name, county, source…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search cameras"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {rows.length} of {cameras.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
              All ({cameras.length})
            </FilterChip>
            <FilterChip
              active={statusFilter === "online"}
              onClick={() => setStatusFilter("online")}
              color="#22c55e"
            >
              Online ({counts.online})
            </FilterChip>
            <FilterChip
              active={statusFilter === "stale"}
              onClick={() => setStatusFilter("stale")}
              color="#f4a261"
            >
              Stale ({counts.stale})
            </FilterChip>
            <FilterChip
              active={statusFilter === "offline"}
              onClick={() => setStatusFilter("offline")}
              color="#ef4444"
            >
              Offline ({counts.offline})
            </FilterChip>

            <div className="ml-auto flex items-center gap-2">
              <label htmlFor="aw-sort" className="text-muted-foreground">
                Sort
              </label>
              <select
                id="aw-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="status">Status</option>
                <option value="updated">Recently updated</option>
                <option value="name">Name</option>
                <option value="location">Location</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ul className="mx-auto grid max-w-6xl gap-2 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {rows.map(({ c, s }) => {
            const active = c.site.id === selectedId;
            const loc = [c.site.county, c.site.state].filter(Boolean).join(", ") || "Unknown location";
            return (
              <li key={c.site.id}>
                <button
                  onClick={() => onSelect(c.site.id)}
                  className={`group flex w-full gap-3 rounded-xl border bg-card/60 p-3 text-left transition-all hover:border-primary/50 hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]" : "border-border"
                  }`}
                >
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                    {c.image.url ? (
                      <img
                        src={c.image.url}
                        alt={`Latest frame from ${c.name}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        no frame
                      </div>
                    )}
                    <span
                      className="absolute left-1 top-1 h-2 w-2 rounded-full ring-2 ring-background"
                      style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-semibold leading-tight">
                        {c.name}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          background: `color-mix(in oklab, ${s.color} 18%, transparent)`,
                          color: s.color,
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      <span className="truncate">{loc}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {relTime(c.image.time) ?? "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Signal className="h-3 w-3" aria-hidden="true" />
                        {s.signal}/4
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No cameras match your filters.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 4px ${color}` }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
