"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, ImageSource, Map as MLMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRenderMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { bboxOf, type PolygonGeometry } from "../model";
import type { Corners, LineGeometry } from "../geo";

export type EditKind = "region" | "road" | "stop" | "plan";

export type EditTarget =
  | { kind: "region"; id: string | null; geometry: PolygonGeometry | null }
  | { kind: "road"; id: string | null; geometry: LineGeometry | null }
  | { kind: "stop"; id: string | null; point: [number, number] | null }
  | { kind: "plan"; id: string | null; corners: Corners; imageUrl: string | null; opacity: number };

export type DisplayData = {
  regions: { id: string; geometry: PolygonGeometry }[];
  roads: { id: string; geometry: LineGeometry }[];
  stops: { id: string; lng: number; lat: number }[];
  plans: { id: string; imageUrl: string; corners: Corners; opacity: number }[];
};

export type EditorGeometry =
  | { kind: "region"; geometry: PolygonGeometry }
  | { kind: "road"; geometry: LineGeometry }
  | { kind: "stop"; point: [number, number] };

type Props = {
  data: DisplayData;
  editing: EditTarget | null;
  /** Changes whenever a different edit session starts, so the canvas reloads its drawing state. */
  sessionKey: string;
  fit: { bbox: [number, number, number, number]; nonce: number } | null;
  onGeometry: (g: EditorGeometry) => void;
  onCorners: (c: Corners) => void;
  onPick: (kind: Exclude<EditKind, "plan">, id: string) => void;
  labels: { mapLabel: string; loadError: string };
};

const MODE_NAME = { region: "polygon", road: "linestring", stop: "point" } as const;
const BRAND = "#0b6b57";
const EMPTY = { type: "FeatureCollection" as const, features: [] };

const fc = (features: unknown[]) => ({ type: "FeatureCollection" as const, features }) as never;

export function EditorCanvas({ data, editing, sessionKey, fit, onGeometry, onCorners, onPick, labels }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const planIdsRef = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Latest props for event handlers created once.
  const live = useRef({ editing, onGeometry, onCorners, onPick });
  useEffect(() => {
    live.current = { editing, onGeometry, onCorners, onPick };
  });
  const initialData = useRef(data);

  // ---- create the map and the drawing engine once ----
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    let draw: TerraDraw | null = null;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        if (cancelled || !container.current) return;
        libRef.current = maplibre;

        const instance = new maplibre.Map({
          container: container.current,
          style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
              osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          },
          center: [66, 41.5],
          zoom: 4.6,
          attributionControl: { compact: true },
        });
        map = instance;
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        instance.on("load", () => {
          instance.addSource("ed-regions", { type: "geojson", data: EMPTY });
          instance.addSource("ed-roads", { type: "geojson", data: EMPTY });
          instance.addSource("ed-stops", { type: "geojson", data: EMPTY });
          instance.addLayer({ id: "ed-regions-fill", type: "fill", source: "ed-regions", paint: { "fill-color": BRAND, "fill-opacity": 0.15 } });
          instance.addLayer({ id: "ed-regions-line", type: "line", source: "ed-regions", paint: { "line-color": BRAND, "line-width": 2 } });
          instance.addLayer({ id: "ed-roads", type: "line", source: "ed-roads", paint: { "line-color": ["match", ["get", "kind"], "rail", "#475569", "#b45309"], "line-width": 3 } });
          instance.addLayer({ id: "ed-stops", type: "circle", source: "ed-stops", paint: { "circle-radius": 7, "circle-color": "#1d4ed8", "circle-stroke-width": 2.5, "circle-stroke-color": "#fff" } });

          for (const layer of ["ed-regions-fill", "ed-roads", "ed-stops"]) {
            instance.on("mouseenter", layer, () => {
              if (!live.current.editing) instance.getCanvas().style.cursor = "pointer";
            });
            instance.on("mouseleave", layer, () => (instance.getCanvas().style.cursor = ""));
          }
          instance.on("click", (e) => {
            if (live.current.editing) return; // while editing, clicks belong to the drawing tools
            const hit = instance.queryRenderedFeatures(e.point, { layers: ["ed-stops", "ed-roads", "ed-regions-fill"] })[0];
            if (!hit) return;
            const kind = hit.layer.id === "ed-stops" ? "stop" : hit.layer.id === "ed-roads" ? "road" : "region";
            live.current.onPick(kind, String(hit.properties.id));
          });

          draw = new TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({ map: instance }),
            modes: [
              new TerraDrawPolygonMode(),
              new TerraDrawLineStringMode(),
              new TerraDrawPointMode(),
              new TerraDrawRenderMode({ modeName: "render", styles: {} }),
              new TerraDrawSelectMode({
                flags: {
                  polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
                  linestring: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
                  point: { feature: { draggable: true } },
                },
              }),
            ],
          });
          draw.start();
          drawRef.current = draw;

          // A finished shape moves straight into edit mode so vertices can be adjusted.
          draw.on("finish", (id, context) => {
            if (context.action === "draw" && draw) {
              emit(draw);
              draw.setMode("select");
              draw.selectFeature(id);
            }
          });
          draw.on("change", (_ids, type) => {
            if (type === "update" && draw) emit(draw);
          });

          function emit(d: TerraDraw) {
            const target = live.current.editing;
            if (!target || target.kind === "plan") return;
            const feature = d.getSnapshot().find((f) => f.properties.mode === MODE_NAME[target.kind]);
            if (!feature) return;
            const g = JSON.parse(JSON.stringify(feature.geometry));
            if (target.kind === "region" && g.type === "Polygon") live.current.onGeometry({ kind: "region", geometry: g });
            else if (target.kind === "road" && g.type === "LineString") live.current.onGeometry({ kind: "road", geometry: g });
            else if (target.kind === "stop" && g.type === "Point") live.current.onGeometry({ kind: "stop", point: g.coordinates });
          }

          mapRef.current = instance;
          setReady(true);
        });
        instance.on("error", (e) => {
          if (!mapRef.current && e.error) setFailed(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      try {
        draw?.stop();
      } catch {
        /* map may already be gone */
      }
      drawRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  // ---- display data (everything except the entity being edited) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("ed-regions") as GeoJSONSource).setData(
      fc(data.regions.map((r) => ({ type: "Feature", geometry: r.geometry, properties: { id: r.id } }))),
    );
    (map.getSource("ed-roads") as GeoJSONSource).setData(
      fc(data.roads.map((r) => ({ type: "Feature", geometry: r.geometry, properties: { id: r.id } }))),
    );
    (map.getSource("ed-stops") as GeoJSONSource).setData(
      fc(data.stops.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { id: s.id } }))),
    );

    // Plan images: add, update and remove by id.
    const seen = new Set<string>();
    for (const p of data.plans) {
      seen.add(p.id);
      const srcId = `plan-${p.id}`;
      const existing = map.getSource(srcId) as ImageSource | undefined;
      if (existing) {
        existing.setCoordinates(p.corners);
        map.setPaintProperty(srcId, "raster-opacity", p.opacity);
      } else {
        map.addSource(srcId, { type: "image", url: p.imageUrl, coordinates: p.corners });
        map.addLayer({ id: srcId, type: "raster", source: srcId, paint: { "raster-opacity": p.opacity } }, "ed-regions-fill");
      }
    }
    for (const id of planIdsRef.current) {
      if (!seen.has(id)) {
        map.removeLayer(`plan-${id}`);
        map.removeSource(`plan-${id}`);
      }
    }
    planIdsRef.current = seen;
  }, [data, ready]);

  // ---- start or stop an edit session ----
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    const maplibre = libRef.current;
    if (!map || !draw || !maplibre || !ready) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (map.getLayer("edit-plan")) map.removeLayer("edit-plan");
    if (map.getSource("edit-plan")) map.removeSource("edit-plan");
    draw.clear();

    const target = live.current.editing;
    if (!target) {
      draw.setMode("render");
      return;
    }

    if (target.kind === "plan") {
      draw.setMode("render");
      const corners = target.corners.map((c) => [...c]) as Corners;
      if (target.imageUrl) {
        map.addSource("edit-plan", { type: "image", url: target.imageUrl, coordinates: corners });
        map.addLayer({ id: "edit-plan", type: "raster", source: "edit-plan", paint: { "raster-opacity": target.opacity } }, "ed-regions-fill");
      }
      corners.forEach((c, i) => {
        const el = document.createElement("div");
        el.className = "h-5 w-5 cursor-grab rounded-full border-2 border-white bg-amber-500 shadow";
        el.setAttribute("aria-hidden", "true");
        const marker = new maplibre.Marker({ element: el, draggable: true }).setLngLat(c as [number, number]).addTo(map);
        marker.on("drag", () => {
          const p = marker.getLngLat();
          corners[i] = [p.lng, p.lat];
          (map.getSource("edit-plan") as ImageSource | undefined)?.setCoordinates(corners);
        });
        marker.on("dragend", () => live.current.onCorners(corners.map((x) => [...x]) as Corners));
        markersRef.current.push(marker);
      });
      return;
    }

    const modeName = MODE_NAME[target.kind];
    const existing =
      target.kind === "stop"
        ? target.point && ({ type: "Point", coordinates: target.point } as const)
        : target.geometry;

    if (existing && existing.type !== "MultiPolygon") {
      const id = crypto.randomUUID();
      const feature = { id, type: "Feature", geometry: existing, properties: { mode: modeName } } as unknown as GeoJSONStoreFeatures;
      draw.addFeatures([feature]);
      draw.setMode("select");
      draw.selectFeature(id);
    } else if (!existing) {
      draw.setMode(modeName);
    } else {
      draw.setMode("render"); // multi-part geometry cannot be edited vertex by vertex
      draw.addFeatures([
        { id: crypto.randomUUID(), type: "Feature", geometry: existing, properties: { mode: "polygon" } } as unknown as GeoJSONStoreFeatures,
      ]);
    }
  }, [sessionKey, ready]);

  // ---- camera ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fit) return;
    const [w, s, e, n] = fit.bbox;
    if (w === e && s === n) map.flyTo({ center: [w, s], zoom: Math.max(map.getZoom(), 12), duration: 600 });
    else map.fitBounds(fit.bbox, { padding: 80, maxZoom: 13, duration: 600 });
  }, [fit, ready]);

  // Fit to everything on first load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const boxes = initialData.current.regions.map((r) => bboxOf(r.geometry));
    if (boxes.length === 0) return;
    const all = boxes.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
    map.fitBounds(all as [number, number, number, number], { padding: 60, animate: false, maxZoom: 9 });
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
