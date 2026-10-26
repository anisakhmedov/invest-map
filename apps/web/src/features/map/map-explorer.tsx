"use client";

import { useEffect, useMemo, useState } from "react";
import { pickLocalized } from "@/lib/content";
import type { Locale } from "@/i18n/config";
import { MapCanvas, type FocusTarget, type Selection } from "./map-canvas";
import { LineOrPointCard, ObjectCard, RegionCard, StatusBadge, type MapLabels } from "./cards";
import { FiltersPanel } from "./filters-panel";
import { SearchBox } from "./search-box";
import {
  STATUS_COLORS,
  OBJECT_STATUSES,
  bboxOf,
  filterObjects,
  serializeFilters,
  type Filters,
  type MapObject,
  type MapPlan,
  type MapRegion,
  type MapRoad,
  type MapStop,
  type SearchResult,
} from "./model";

export type MapDict = MapLabels & {
  mapLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  noResults: string;
  layers: string;
  layerRegions: string;
  layerObjects: string;
  layerRoads: string;
  layerStops: string;
  layerPlans: string;
  filters: string;
  reset: string;
  category: string;
  status: string;
  areaRange: string;
  areaMin: string;
  areaMax: string;
  priceMax: string;
  found: string;
  legend: string;
  showList: string;
  showMap: string;
  loadError: string;
  noData: string;
};

export function MapExplorer({
  locale,
  regions,
  objects,
  roads,
  stops,
  plans,
  initialFilters,
  dict,
}: {
  locale: Locale;
  regions: MapRegion[];
  objects: MapObject[];
  roads: MapRoad[];
  stops: MapStop[];
  plans: MapPlan[];
  initialFilters: Filters;
  dict: MapDict;
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selected, setSelected] = useState<Selection>(null);
  const [focus, setFocus] = useState<FocusTarget>(null);
  const [layers, setLayers] = useState({ regions: true, objects: true, roads: true, stops: true, plans: true });
  const [view, setView] = useState<"map" | "list">("map");

  const visible = useMemo(() => filterObjects(objects, filters), [objects, filters]);
  const regionById = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);

  // Keep the URL shareable without triggering navigation.
  useEffect(() => {
    const qs = serializeFilters(filters);
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters]);

  // MapLibre needs a nudge when its container becomes visible again on small screens.
  useEffect(() => {
    if (view === "map") window.dispatchEvent(new Event("resize"));
  }, [view]);

  let focusNonce = 0;
  const nextNonce = () => ++focusNonce + Date.now();

  function selectObject(id: string, fly = true) {
    const o = objects.find((x) => x.id === id);
    if (!o) return;
    setSelected({ type: "object", id });
    if (fly) setFocus({ point: [o.lng, o.lat], nonce: nextNonce() });
  }

  function selectRegion(id: string) {
    const r = regionById.get(id);
    if (!r) return;
    setSelected({ type: "region", id });
    setFocus({ bbox: bboxOf(r.geometry), nonce: nextNonce() });
  }

  function onPick(r: SearchResult) {
    setFilters((f) => ({ ...f, q: "" }));
    setView("map");
    if (r.type === "region") selectRegion(r.id);
    else selectObject(r.id);
  }

  const selectedObject = selected?.type === "object" ? objects.find((o) => o.id === selected.id) : undefined;
  const selectedRegion = selected?.type === "region" ? regionById.get(selected.id) : undefined;
  const selectedRoad = selected?.type === "road" ? roads.find((r) => r.id === selected.id) : undefined;
  const selectedStop = selected?.type === "stop" ? stops.find((x) => x.id === selected.id) : undefined;
  const contactsHref = `/${locale}/request${selectedObject ? `?object=${selectedObject.id}` : ""}`;

  const tab = (v: "map" | "list", label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={`flex-1 px-4 py-2.5 text-sm font-medium ${view === v ? "bg-brand text-brand-fg" : "bg-surface text-fg"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex overflow-hidden border-b border-border lg:hidden">
        {tab("map", dict.showMap)}
        {tab("list", `${dict.showList} (${visible.length})`)}
      </div>

      <div className="grid h-[calc(100dvh-10.5rem)] min-h-[520px] lg:h-[calc(100dvh-8rem)] lg:grid-cols-[380px_1fr]">
        <aside className={`${view === "list" ? "block" : "hidden"} overflow-y-auto border-r border-border bg-surface p-4 lg:block`}>
          <div className="space-y-5">
            <SearchBox
              regions={regions}
              objects={objects}
              locale={locale}
              value={filters.q}
              onChange={(q) => setFilters((f) => ({ ...f, q }))}
              onPick={onPick}
              labels={{ ...dict, region: dict.region }}
            />

            <fieldset>
              <legend className="mb-1 text-sm font-medium">{dict.layers}</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={layers.regions} onChange={(e) => setLayers((l) => ({ ...l, regions: e.target.checked }))} />
                  {dict.layerRegions}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={layers.objects} onChange={(e) => setLayers((l) => ({ ...l, objects: e.target.checked }))} />
                  {dict.layerObjects}
                </label>
                {roads.length > 0 && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={layers.roads} onChange={(e) => setLayers((l) => ({ ...l, roads: e.target.checked }))} />
                    {dict.layerRoads}
                  </label>
                )}
                {stops.length > 0 && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={layers.stops} onChange={(e) => setLayers((l) => ({ ...l, stops: e.target.checked }))} />
                    {dict.layerStops}
                  </label>
                )}
                {plans.length > 0 && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={layers.plans} onChange={(e) => setLayers((l) => ({ ...l, plans: e.target.checked }))} />
                    {dict.layerPlans}
                  </label>
                )}
              </div>
            </fieldset>

            <FiltersPanel filters={filters} onChange={setFilters} labels={dict} />

            <div>
              <h2 className="mb-1 text-sm font-medium">{dict.legend}</h2>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {OBJECT_STATUSES.map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s] }} />
                    {dict.statuses[s]}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold">{dict.listTitle}</h2>
              <p aria-live="polite" className="mb-2 text-sm text-muted">
                {dict.found}: {visible.length}
              </p>
              {visible.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">{dict.emptyList}</p>
              ) : (
                <ul className="space-y-1">
                  {visible.slice(0, 200).map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setView("map");
                          selectObject(o.id);
                        }}
                        aria-current={selected?.type === "object" && selected.id === o.id ? "true" : undefined}
                        className={`flex w-full flex-col items-start gap-1 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 ${
                          selected?.type === "object" && selected.id === o.id ? "bg-brand-soft" : ""
                        }`}
                      >
                        <span className="font-medium">{pickLocalized(o.name, locale).text}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <StatusBadge status={o.status} labels={dict} />
                          {pickLocalized(regionById.get(o.regionId)?.name, locale).text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>

        <div className={`${view === "map" ? "block" : "hidden"} relative lg:block`}>
          <MapCanvas
            regions={regions}
            objects={visible}
            roads={roads}
            stops={stops}
            plans={plans}
            locale={locale}
            layers={layers}
            selected={selected}
            focus={focus}
            onSelect={(s) => {
              if (!s) return setSelected(null);
              if (s.type === "region") selectRegion(s.id);
              else if (s.type === "object") selectObject(s.id, false);
              else setSelected(s);
            }}
            labels={dict}
          />
          {regions.length === 0 && (
            <p className="m-4 rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">{dict.noData}</p>
          )}
          {(selectedObject || selectedRegion || selectedRoad || selectedStop) && (
            <div className="absolute inset-x-3 bottom-3 z-10 max-h-[65%] overflow-y-auto lg:right-auto lg:w-96">
              {selectedObject && (
                <ObjectCard
                  object={selectedObject}
                  region={regionById.get(selectedObject.regionId)}
                  locale={locale}
                  labels={dict}
                  contactsHref={contactsHref}
                  onClose={() => setSelected(null)}
                />
              )}
              {selectedRoad && (
                <LineOrPointCard title={pickLocalized(selectedRoad.name, locale).text} kind={selectedRoad.kind} labels={dict} onClose={() => setSelected(null)} />
              )}
              {selectedStop && (
                <LineOrPointCard title={pickLocalized(selectedStop.name, locale).text} kind={selectedStop.kind} labels={dict} onClose={() => setSelected(null)} />
              )}
              {selectedRegion && (
                <RegionCard
                  region={selectedRegion}
                  objects={visible}
                  locale={locale}
                  labels={dict}
                  onSelectObject={(id) => selectObject(id)}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
