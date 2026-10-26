"use client";

import { useId, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { searchItems, type MapObject, type MapRegion, type SearchResult } from "./model";

export function SearchBox({
  regions,
  objects,
  locale,
  value,
  onChange,
  onPick,
  labels,
}: {
  regions: MapRegion[];
  objects: MapObject[];
  locale: Locale;
  value: string;
  onChange: (v: string) => void;
  onPick: (r: SearchResult) => void;
  labels: { searchLabel: string; searchPlaceholder: string; noResults: string; region: string; categories: Record<string, string> };
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchItems(regions, objects, value, locale), [regions, objects, value, locale]);
  const showList = open && value.trim() !== "";
  const optionId = (i: number) => `${id}-opt-${i}`;

  function pick(r: SearchResult) {
    setOpen(false);
    onPick(r);
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {labels.searchLabel}
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showList && results.length ? optionId(active) : undefined}
        autoComplete="off"
        value={value}
        placeholder={labels.searchPlaceholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && showList && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2"
      />
      {showList && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={labels.searchLabel}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-muted">
              {labels.noResults}
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={`${r.type}-${r.id}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-brand-soft" : ""}`}
              >
                {r.label}
                <span className="ml-2 text-xs text-muted">{r.type === "region" ? labels.region : ""}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
