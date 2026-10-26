import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_FEATURES,
  MAX_VERTICES,
  centroidOf,
  cornersFromBbox,
  parseGeoJSONImport,
  ringArea,
  ringSelfIntersects,
  toFeatureCollection,
  validateCorners,
  validatePolygonGeometry,
} from "./geo";

const sq = (x = 0, y = 0, s = 2) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]] as [number, number][];
const poly = (ring = sq()) => ({ type: "Polygon" as const, coordinates: [ring] });
const bowtie = [[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]] as [number, number][];

describe("ring helpers", () => {
  it("detects crossing edges but not simple shapes", () => {
    expect(ringSelfIntersects(sq())).toBe(false);
    expect(ringSelfIntersects(bowtie)).toBe(true);
  });

  it("accepts concave polygons", () => {
    const l = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4], [0, 0]] as [number, number][];
    expect(ringSelfIntersects(l)).toBe(false);
  });

  it("does not flag touching vertices as crossings", () => {
    const touch = [[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 1], [0, 0]] as [number, number][];
    expect(ringSelfIntersects(touch)).toBe(false);
  });

  it("computes signed area", () => {
    expect(ringArea(sq(0, 0, 2))).toBe(4);
    expect(ringArea([...sq(0, 0, 2)].reverse())).toBe(-4);
  });
});

describe("validatePolygonGeometry", () => {
  it("accepts a normal polygon and multipolygon", () => {
    expect(validatePolygonGeometry(poly()).ok).toBe(true);
    expect(validatePolygonGeometry({ type: "MultiPolygon", coordinates: [[sq()], [sq(10, 10)]] }).ok).toBe(true);
  });

  it("reports the reason for bad input", () => {
    expect(validatePolygonGeometry(poly(bowtie))).toEqual({ ok: false, error: "self_intersection" });
    expect(validatePolygonGeometry(poly(sq(0, 0, 0)))).toEqual({ ok: false, error: "zero_area" });
    expect(validatePolygonGeometry({ type: "Point", coordinates: [0, 0] })).toEqual({ ok: false, error: "invalid" });
    expect(validatePolygonGeometry(poly(sq(500, 0)))).toEqual({ ok: false, error: "invalid" });
    expect(validatePolygonGeometry(null)).toEqual({ ok: false, error: "invalid" });
  });

  it("rejects huge polygons before the quadratic intersection check", () => {
    const ring: [number, number][] = Array.from({ length: MAX_VERTICES + 10 }, (_, i) => [Math.cos(i) * 10, Math.sin(i) * 10]);
    ring.push(ring[0]);
    expect(validatePolygonGeometry(poly(ring))).toEqual({ ok: false, error: "too_many_vertices" });
  });
});

describe("coordinates with altitude", () => {
  const z = (ring: [number, number][]) => ring.map(([x, y]) => [x, y, 412.5]);

  it("drops the third value instead of rejecting the geometry", () => {
    const r = validatePolygonGeometry({ type: "Polygon", coordinates: [z(sq())] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.geometry.coordinates[0][0]).toEqual([0, 0]);
  });

  it("imports 3D features of every type", () => {
    const text = JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { name: "A" }, geometry: { type: "Polygon", coordinates: [z(sq())] } },
        { type: "Feature", properties: { name: "B" }, geometry: { type: "LineString", coordinates: [[0, 0, 5], [1, 1, 6]] } },
        { type: "Feature", properties: { name: "C" }, geometry: { type: "Point", coordinates: [69.2, 41.3, 440] } },
      ],
    });
    const r = parseGeoJSONImport(text);
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.issues).toEqual([]);
    expect(r.roads[0].geometry.coordinates).toEqual([[0, 0], [1, 1]]);
    expect(r.stops[0]).toMatchObject({ lng: 69.2, lat: 41.3 });
  });

  it("still rejects coordinates that are not numbers or are out of range", () => {
    expect(validatePolygonGeometry({ type: "Polygon", coordinates: [[["a", 0, 1], [1, 0], [1, 1], [0, 0]]] }).ok).toBe(false);
    expect(validatePolygonGeometry({ type: "Polygon", coordinates: [[[0, 91, 5], [1, 0], [1, 1], [0, 91, 5]]] }).ok).toBe(false);
  });
});

describe("centroid and corners", () => {
  it("finds the centre of a square", () => {
    expect(centroidOf(poly(sq(10, 20, 4)))).toEqual([12, 22]);
  });

  it("uses the largest polygon of a multipolygon", () => {
    const [x, y] = centroidOf({ type: "MultiPolygon", coordinates: [[sq(0, 0, 1)], [sq(100, 50, 10)]] });
    expect(x).toBeCloseTo(105);
    expect(y).toBeCloseTo(55);
  });

  it("works for either ring direction", () => {
    const [x, y] = centroidOf(poly([...sq(0, 0, 2)].reverse()));
    expect([x, y]).toEqual([1, 1]);
  });

  it("builds corners clockwise from NW", () => {
    expect(cornersFromBbox([1, 2, 5, 8])).toEqual([[1, 8], [5, 8], [5, 2], [1, 2]]);
  });

  it("validates quadrilaterals", () => {
    expect(validateCorners(cornersFromBbox([0, 0, 2, 2])).ok).toBe(true);
    expect(validateCorners([[0, 0], [1, 1], [2, 2], [3, 3]])).toEqual({ ok: false, error: "degenerate" });
    expect(validateCorners([[0, 2], [2, 0], [2, 2], [0, 0]])).toEqual({ ok: false, error: "bowtie" });
    expect(validateCorners([[0, 0], [1, 1]])).toEqual({ ok: false, error: "invalid" });
    expect(validateCorners([[0, 0], [1, 0], [1, 1], [999, 1]])).toEqual({ ok: false, error: "invalid" });
  });
});

describe("parseGeoJSONImport", () => {
  const fc = (...features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });
  const feature = (geometry: unknown, properties: unknown = {}) => ({ type: "Feature", geometry, properties });

  it("sorts features into regions, roads and stops", () => {
    const r = parseGeoJSONImport(
      fc(
        feature(poly(), { name: "Hudud", name_ru: "Район", description_en: "Desc" }),
        feature({ type: "LineString", coordinates: [[0, 0], [1, 1]] }, { name: "Yo‘l", kind: "rail" }),
        feature({ type: "Point", coordinates: [69.2, 41.3] }, { "name:en": "Stop", kind: "train" }),
      ),
    );
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.issues).toEqual([]);
    expect(r.regions[0].name).toEqual({ uz: "Hudud", oz: "", ru: "Район", en: "" });
    expect(r.regions[0].description.en).toBe("Desc");
    expect(r.roads[0]).toMatchObject({ kind: "rail", name: { uz: "Yo‘l" } });
    expect(r.stops[0]).toMatchObject({ kind: "train", lng: 69.2, lat: 41.3, name: { en: "Stop" } });
  });

  it("accepts a bare geometry and a single feature", () => {
    const bare = parseGeoJSONImport(JSON.stringify(poly()));
    const single = parseGeoJSONImport(JSON.stringify(feature(poly())));
    for (const r of [bare, single]) {
      if ("fatal" in r) throw new Error(r.fatal);
      expect(r.regions).toHaveLength(1);
    }
  });

  it("reports bad features with their index and keeps the good ones", () => {
    const r = parseGeoJSONImport(
      fc(
        feature(poly(bowtie)),
        feature(poly()),
        feature({ type: "LineString", coordinates: [[0, 0]] }),
        feature({ type: "Point", coordinates: [500, 0] }),
        feature({ type: "GeometryCollection", geometries: [] }),
        { type: "Feature", geometry: null },
        "junk",
      ),
    );
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.regions).toHaveLength(1);
    expect(r.issues).toEqual([
      { index: 0, reason: "self_intersection" },
      { index: 2, reason: "invalid" },
      { index: 3, reason: "invalid" },
      { index: 4, reason: "unsupported_geometry" },
      { index: 5, reason: "not_a_feature" },
      { index: 6, reason: "not_a_feature" },
    ]);
  });

  it("returns fatal errors for unusable input", () => {
    expect(parseGeoJSONImport("not json")).toEqual({ fatal: "not_json" });
    expect(parseGeoJSONImport("42")).toEqual({ fatal: "not_geojson" });
    expect(parseGeoJSONImport("null")).toEqual({ fatal: "not_geojson" });
    expect(parseGeoJSONImport(JSON.stringify({ type: "Topology" }))).toEqual({ fatal: "not_geojson" });
    expect(parseGeoJSONImport("x".repeat(MAX_IMPORT_BYTES + 1))).toEqual({ fatal: "too_large" });
    const many = Array.from({ length: MAX_IMPORT_FEATURES + 1 }, () => feature(poly()));
    expect(parseGeoJSONImport(fc(...many))).toEqual({ fatal: "too_many_features" });
  });

  it("truncates very long names and ignores non-string ones", () => {
    const r = parseGeoJSONImport(fc(feature(poly(), { name: "x".repeat(500), name_ru: 5 })));
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.regions[0].name.uz).toHaveLength(200);
    expect(r.regions[0].name.ru).toBe("");
  });

  it("falls back to default kinds for unknown values", () => {
    const r = parseGeoJSONImport(
      fc(
        feature({ type: "LineString", coordinates: [[0, 0], [1, 1]] }, { kind: "monorail" }),
        feature({ type: "Point", coordinates: [1, 1] }, { kind: "ferry" }),
      ),
    );
    if ("fatal" in r) throw new Error(r.fatal);
    expect(r.roads[0].kind).toBe("road");
    expect(r.stops[0].kind).toBe("bus");
  });
});

describe("toFeatureCollection", () => {
  it("exports all layers and round-trips through import", () => {
    const exported = toFeatureCollection({
      regions: [{ id: "1", slug: "r", name: { uz: "Hudud", ru: "Район" }, description: {}, geometry: poly() }],
      roads: [{ id: "2", slug: "d", kind: "rail", name: { uz: "Yo‘l" }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }],
      stops: [{ id: "3", slug: "s", kind: "train", name: { en: "Stop" }, lng: 69.2, lat: 41.3 }],
    });
    expect(exported.features.map((f) => f.properties.layer)).toEqual(["region", "road", "stop"]);
    expect(exported.features[0].properties).toMatchObject({ name: "Hudud", name_uz: "Hudud", name_ru: "Район" });

    const back = parseGeoJSONImport(JSON.stringify(exported));
    if ("fatal" in back) throw new Error(back.fatal);
    expect(back.issues).toEqual([]);
    expect(back.regions[0].name).toMatchObject({ uz: "Hudud", ru: "Район" });
    expect(back.roads[0].kind).toBe("rail");
    expect(back.stops[0]).toMatchObject({ kind: "train", lng: 69.2, lat: 41.3 });
  });
});
