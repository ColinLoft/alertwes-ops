import { useMemo, useState } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import type { Camera, Status } from "@/lib/alertwest";

export interface Filters {
  states: Set<string>;
  counties: Set<string>;
  brands: Set<string>;
  statuses: Set<Status>;
}

export const emptyFilters = (): Filters => ({
  states: new Set(),
  counties: new Set(),
  brands: new Set(),
  statuses: new Set(),
});

export function filtersActiveCount(f: Filters): number {
  return f.states.size + f.counties.size + f.brands.size + f.statuses.size;
}

export function FilterBar({
  cameras,
  filters,
  onChange,
  cameraStatuses,
}: {
  cameras: Camera[];
  filters: Filters;
  onChange: (f: Filters) => void;
  cameraStatuses: Map<string, Status>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const { states, counties, brands } = useMemo(() => {
    const s = new Set<string>();
    const c = new Set<string>();
    const b = new Set<string>();
    for (const cam of cameras) {
      if (cam.site.state) s.add(cam.site.state);
      if (cam.site.county) c.add(cam.site.county);
      const brand = cam.parameters["Brand.Brand"];
      if (brand) b.add(brand);
    }
    return {
      states: [...s].sort(),
      counties: [...c].sort(),
      brands: [...b].sort(),
    };
  }, [cameras]);

  const statusOptions: Status[] = ["online", "stale", "offline", "unknown"];

  const toggle = (key: keyof Filters, value: string) => {
    const set = new Set(filters[key] as Set<string>);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({ ...filters, [key]: set } as Filters);
  };

  const active = filtersActiveCount(filters);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/85 px-2 py-1.5 backdrop-blur-md">
      <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Filters</span>
        {active > 0 && (
          <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">
            {active}
          </span>
        )}
      </div>

      <FilterDropdown
        label="Status"
        open={open === "status"}
        onToggle={() => setOpen(open === "status" ? null : "status")}
        count={filters.statuses.size}
      >
        {statusOptions.map((s) => {
          const checked = filters.statuses.has(s);
          const camCount = [...cameraStatuses.values()].filter((cs) => cs === s).length;
          return (
            <CheckRow
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              hint={`${camCount}`}
              checked={checked}
              onClick={() => {
                const set = new Set(filters.statuses);
                if (set.has(s)) set.delete(s);
                else set.add(s);
                onChange({ ...filters, statuses: set });
              }}
            />
          );
        })}
      </FilterDropdown>

      <FilterDropdown
        label="State"
        open={open === "state"}
        onToggle={() => setOpen(open === "state" ? null : "state")}
        count={filters.states.size}
      >
        {states.map((s) => (
          <CheckRow
            key={s}
            label={s}
            checked={filters.states.has(s)}
            onClick={() => toggle("states", s)}
          />
        ))}
      </FilterDropdown>

      <FilterDropdown
        label="County"
        open={open === "county"}
        onToggle={() => setOpen(open === "county" ? null : "county")}
        count={filters.counties.size}
      >
        {counties.map((c) => (
          <CheckRow
            key={c}
            label={c}
            checked={filters.counties.has(c)}
            onClick={() => toggle("counties", c)}
          />
        ))}
      </FilterDropdown>

      <FilterDropdown
        label="Brand"
        open={open === "brand"}
        onToggle={() => setOpen(open === "brand" ? null : "brand")}
        count={filters.brands.size}
      >
        {brands.map((b) => (
          <CheckRow
            key={b}
            label={b}
            checked={filters.brands.has(b)}
            onClick={() => toggle("brands", b)}
          />
        ))}
      </FilterDropdown>

      {active > 0 && (
        <button
          onClick={() => onChange(emptyFilters())}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}

function FilterDropdown({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
          count > 0
            ? "bg-primary/15 text-primary"
            : "text-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {label}
        {count > 0 && <span className="font-semibold">·{count}</span>}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[1100] mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-border bg-popover/95 p-1 shadow-xl backdrop-blur-md">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckRow({
  label,
  hint,
  checked,
  onClick,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent ${
        checked ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
            checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
          }`}
        >
          {checked && <span className="text-[10px] leading-none">✓</span>}
        </span>
        {label}
      </span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </button>
  );
}
