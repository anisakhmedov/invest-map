"use client";

import {
  OBJECT_CATEGORIES,
  OBJECT_STATUSES,
  STATUS_COLORS,
  EMPTY_FILTERS,
  activeFilterCount,
  type Filters,
  type ObjectCategory,
  type ObjectStatusKey,
} from "./model";

type Labels = {
  filters: string;
  reset: string;
  category: string;
  status: string;
  areaRange: string;
  areaMin: string;
  areaMax: string;
  priceMax: string;
  categories: Record<string, string>;
  statuses: Record<string, string>;
};

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

const numberInput = "w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm";

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          const n = raw === "" ? null : Number(raw);
          onChange(n !== null && Number.isFinite(n) && n >= 0 ? n : null);
        }}
        className={numberInput}
      />
    </div>
  );
}

export function FiltersPanel({ filters, onChange, labels }: { filters: Filters; onChange: (f: Filters) => void; labels: Labels }) {
  const count = activeFilterCount(filters);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {labels.filters}
          {count > 0 && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs text-brand-fg">{count}</span>}
        </h2>
        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS, q: filters.q, region: filters.region })}
            className="text-sm font-medium text-brand underline underline-offset-4"
          >
            {labels.reset}
          </button>
        )}
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{labels.category}</legend>
        <div className="flex flex-wrap gap-2">
          {OBJECT_CATEGORIES.map((c: ObjectCategory) => {
            const on = filters.categories.includes(c);
            return (
              <label key={c} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand-soft font-medium" : "border-border bg-surface"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}
                />
                {labels.categories[c]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{labels.status}</legend>
        <div className="flex flex-wrap gap-2">
          {OBJECT_STATUSES.map((s: ObjectStatusKey) => {
            const on = filters.statuses.includes(s);
            return (
              <label key={s} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand-soft font-medium" : "border-border bg-surface"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}
                />
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                {labels.statuses[s]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{labels.areaRange}</legend>
        <div className="grid grid-cols-2 gap-2">
          <NumberField id="area-min" label={labels.areaMin} value={filters.areaMin} onChange={(v) => onChange({ ...filters, areaMin: v })} />
          <NumberField id="area-max" label={labels.areaMax} value={filters.areaMax} onChange={(v) => onChange({ ...filters, areaMax: v })} />
        </div>
      </fieldset>

      <NumberField id="price-max" label={labels.priceMax} value={filters.priceMax} onChange={(v) => onChange({ ...filters, priceMax: v })} />
    </div>
  );
}
