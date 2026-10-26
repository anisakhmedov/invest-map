"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, ImageSource, Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Locale } from "@/i18n/config";
import {
  STATUS_COLORS,
  bboxOf,
  objectsToGeoJSON,
  regionsToGeoJSON,
  roadsToGeoJSON,
  stopsToGeoJSON,
  type MapObject,
  type MapPlan,
  type MapRegion,
  type MapRoad,
  type MapStop,
} from "./model";

export type Selection = { type: "region" | "object" | "road" | "stop"; id: string } | null;
export type FocusTarget = { bbox: [number, number, number, number]; nonce: number } | { point: [number, number]; nonce: number } | null;

type Props = {
  regions: MapRegion[];
  objects: MapObject[];
  roads: MapRoad[];
  stops: MapStop[];
  plans: MapPlan[];
  locale: Locale;
  layers: { regions: boolean; objects: boolean; roads: boolean; stops: boolean; plans: boolean };
  selected: Selection;
  focus: FocusTarget;
  onSelect: (s: Selection) => void;
  labels: { mapLabel: string; loadError: string };
};

const REGION_LAYERS = ["region-fill", "region-line", "region-label"];
const OBJECT_LAYERS = ["clusters", "cluster-count", "object-point"];
const ROAD_LAYERS = ["road-line"];
const STOP_LAYERS = ["stop-point"];
const GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
const FONT = ["Open Sans Semibold"];

function unionBbox(regions: MapRegion[]): [number, number, number, number] | null {
  if (regions.length === 0) return null;
  return regions.map((r) => bboxOf(r.geometry)).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
}

export function MapCanvas({ regions, objects, roads, stops, plans, locale, layers, selected, focus, onSelect, labels }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  const prevSelected = useRef<Selection>(null);
  const initial = useRef({ regions, objects, roads, stops, locale });
  const planIds = useRef(new Set<string>());

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        if (cancelled || !container.current) return;
        const { regions: r0, objects: o0, roads: ro0, stops: st0, locale: l0 } = initial.current;
        const bounds = unionBbox(r0);

        const instance = new maplibre.Map({
          container: container.current,
          style: {
            version: 8,
            glyphs: GLYPHS,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                maxzoom: 19,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          },
          center: [66, 41.5],
          zoom: 4.6,
          attributionControl: { compact: true },
        });
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        if (bounds) instance.fitBounds(bounds, { padding: 60, animate: false, maxZoom: 9 });

        instance.on("load", () => {
          if (!instance) return;
          instance.addSource("regions", { type: "geojson", data: regionsToGeoJSON(r0, l0), promoteId: "id" });
          instance.addSource("objects", {
            type: "geojson",
            data: objectsToGeoJSON(o0, l0),
            promoteId: "id",
            cluster: true,
            clusterRadius: 45,
            clusterMaxZoom: 12,
          });

          instance.addSource("roads", { type: "geojson", data: roadsToGeoJSON(ro0, l0), promoteId: "id" });
          instance.addSource("stops", { type: "geojson", data: stopsToGeoJSON(st0, l0), promoteId: "id" });

          instance.addLayer({
            id: "region-fill",
            type: "fill",
            source: "regions",
            paint: {
              "fill-color": "#0b6b57",
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "selected"], false], 0.38,
                ["boolean", ["feature-state", "hover"], false], 0.26,
                0.12,
              ],
            },
          });
          instance.addLayer({
            id: "region-line",
            type: "line",
            source: "regions",
            paint: {
              "line-color": "#0b6b57",
              "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3.5, 2],
            },
          });
          instance.addLayer({
            id: "region-label",
            type: "symbol",
            source: "regions",
            layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 14 },
            paint: { "text-color": "#0b3d33", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
          });
          instance.addLayer({
            id: "road-line",
            type: "line",
            source: "roads",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": ["match", ["get", "kind"], "rail", "#475569", "#b45309"],
              "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 6, 3.5],
            },
          });
          instance.addLayer({
            id: "stop-point",
            type: "circle",
            source: "stops",
            paint: {
              "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 9, 6],
              "circle-color": "#0369a1",
              "circle-stroke-width": 2.5,
              "circle-stroke-color": "#ffffff",
            },
          });
          instance.addLayer({
            id: "clusters",
            type: "circle",
            source: "objects",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#1d4ed8",
              "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 15, 26],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#ffffff",
            },
          });
          instance.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "objects",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 13 },
            paint: { "text-color": "#ffffff" },
          });
          instance.addLayer({
            id: "object-point",
            type: "circle",
            source: "objects",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": [
                "match", ["get", "status"],
                "AVAILABLE", STATUS_COLORS.AVAILABLE,
                "RESERVED", STATUS_COLORS.RESERVED,
                "AUCTION", STATUS_COLORS.AUCTION,
                STATUS_COLORS.TAKEN,
              ],
              "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 11, 8],
              "circle-stroke-width": ["case", ["boolean", ["feature-state", "selected"], false], 4, 2.5],
              "circle-stroke-color": "#ffffff",
            },
          });

          let hovered: string | null = null;
          instance.on("mousemove", "region-fill", (e) => {
            const id = e.features?.[0]?.id;
            if (typeof id !== "string" || id === hovered || !instance) return;
            if (hovered) instance.setFeatureState({ source: "regions", id: hovered }, { hover: false });
            hovered = id;
            instance.setFeatureState({ source: "regions", id }, { hover: true });
          });
          instance.on("mouseleave", "region-fill", () => {
            if (hovered && instance) instance.setFeatureState({ source: "regions", id: hovered }, { hover: false });
            hovered = null;
          });
          for (const layer of ["region-fill", "clusters", "object-point", "road-line", "stop-point"]) {
            instance.on("mouseenter", layer, () => instance && (instance.getCanvas().style.cursor = "pointer"));
            instance.on("mouseleave", layer, () => instance && (instance.getCanvas().style.cursor = ""));
          }

          instance.on("click", (e) => {
            if (!instance) return;
            const hit = (ids: string[]): MapGeoJSONFeature | undefined =>
              instance.queryRenderedFeatures(e.point, { layers: ids.filter((id) => instance.getLayer(id)) })[0];

            const cluster = hit(["clusters"]);
            if (cluster) {
              const src = instance.getSource("objects") as GeoJSONSource;
              src.getClusterExpansionZoom(Number(cluster.properties.cluster_id)).then((zoom) => {
                if (cluster.geometry.type === "Point") {
                  instance.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom: zoom + 0.5 });
                }
              });
              return;
            }
            const point = hit(["object-point"]);
            if (point) return onSelectRef.current({ type: "object", id: String(point.properties.id) });
            const stop = hit(["stop-point"]);
            if (stop) return onSelectRef.current({ type: "stop", id: String(stop.properties.id) });
            const road = hit(["road-line"]);
            if (road) return onSelectRef.current({ type: "road", id: String(road.properties.id) });
            const region = hit(["region-fill"]);
            if (region) return onSelectRef.current({ type: "region", id: String(region.properties.id) });
            onSelectRef.current(null);
          });

          setReady(true);
        });
        instance.on("error", (e) => {
          // Tile or glyph hiccups are not fatal; only a failed init is.
          if (!mapRef.current && e.error) setFailed(true);
        });
        map = instance;
        mapRef.current = instance;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  // Push data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("regions") as GeoJSONSource | undefined)?.setData(regionsToGeoJSON(regions, locale));
    (map.getSource("objects") as GeoJSONSource | undefined)?.setData(objectsToGeoJSON(objects, locale));
    (map.getSource("roads") as GeoJSONSource | undefined)?.setData(roadsToGeoJSON(roads, locale));
    (map.getSource("stops") as GeoJSONSource | undefined)?.setData(stopsToGeoJSON(stops, locale));
  }, [regions, objects, roads, stops, locale, ready]);

  // Plan images pinned to the map: add, update and remove by id.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const seen = new Set<string>();
    for (const p of plans) {
      const id = `plan-${p.id}`;
      seen.add(id);
      const existing = map.getSource(id) as ImageSource | undefined;
      if (existing) {
        existing.setCoordinates(p.corners);
        map.setPaintProperty(id, "raster-opacity", p.opacity);
      } else {
        map.addSource(id, { type: "image", url: p.imageUrl, coordinates: p.corners });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": p.opacity } }, "region-fill");
      }
      map.setLayoutProperty(id, "visibility", layers.plans ? "visible" : "none");
    }
    for (const id of planIds.current) {
      if (!seen.has(id)) {
        map.removeLayer(id);
        map.removeSource(id);
      }
    }
    planIds.current = seen;
  }, [plans, layers.plans, ready]);

  // Layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const set = (ids: string[], on: boolean) =>
      ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
    set(REGION_LAYERS, layers.regions);
    set(OBJECT_LAYERS, layers.objects);
    set(ROAD_LAYERS, layers.roads);
    set(STOP_LAYERS, layers.stops);
  }, [layers, ready]);

  // Selection highlight.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = (s: NonNullable<Selection>) => ({ region: "regions", object: "objects", road: "roads", stop: "stops" })[s.type];
    const prev = prevSelected.current;
    if (prev) map.setFeatureState({ source: source(prev), id: prev.id }, { selected: false });
    if (selected) map.setFeatureState({ source: source(selected), id: selected.id }, { selected: true });
    prevSelected.current = selected;
  }, [selected, ready]);

  // Camera moves requested by the parent.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    if ("bbox" in focus) map.fitBounds(focus.bbox, { padding: 70, maxZoom: 10, duration: 700 });
    else map.flyTo({ center: focus.point, zoom: Math.max(map.getZoom(), 11), duration: 700 });
  }, [focus, ready]);

  // Dark theme: a darker basemap and a lighter brand tone, so region outlines keep 3:1 against the map (WCAG 1.4.11).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      map.setPaintProperty("osm", "raster-brightness-max", dark ? 0.3 : 1);
      map.setPaintProperty("osm", "raster-saturation", dark ? -0.5 : 0);
      map.setPaintProperty("region-line", "line-color", dark ? "#3fc3a2" : "#0b6b57");
      map.setPaintProperty("region-fill", "fill-color", dark ? "#3fc3a2" : "#0b6b57");
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" role="application" aria-label={labels.mapLabel} />
      {failed && (
        <p role="alert" className="absolute inset-x-4 top-4 rounded-lg border border-red-500/50 bg-surface p-3 text-sm">
          {labels.loadError}
        </p>
      )}
    </div>
  );
}
