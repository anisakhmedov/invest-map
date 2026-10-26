import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  bboxOf,
  filterObjects,
  matchesQuery,
  normalize,
  objectsToGeoJSON,
  parseFilters,
  regionGeometrySchema,
  regionSummary,
  regionsToGeoJSON,
  searchItems,
  serializeFilters,
  type Filters,
  type MapObject,
  type MapRegion,
  type PolygonGeometry,
} from "./model";

const square = (x: number, y: number, size = 1): PolygonGeometry & { type: "Polygon" } => ({
  type: "Polygon",
  coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
});

const regions: MapRegion[] = [
  { id: "r1", slug: "toshkent", name: { uz: "Toshkent", ru: "Ташкент" }, description: {}, geometry: square(69, 41), center: [69.5, 41.5] },
  { id: "r2", slug: "samarqand", name: { uz: "Samarqand", ru: "Самарканд" }, description: {}, geometry: square(66, 39), center: [66.5, 39.5] },
];

const obj = (over: Partial<MapObject>): MapObject => ({
  id: "o",
  slug: "o",
  regionId: "r1",
  name: { uz: "Obyekt" },
  description: {},
  category: "industry",
  status: "AVAILABLE",
  areaHa: 10,
  priceUsd: 1000,
  lng: 69.2,
  lat: 41.3,
  ...over,
});

const objects: MapObject[] = [
  obj({ id: "a", name: { uz: "Oʻzbek zavodi", ru: "Узбекский завод" }, category: "industry", areaHa: 5, priceUsd: 500 }),
  obj({ id: "b", name: { uz: "Meva bogʻi" }, regionId: "r2", category: "agriculture", status: "AUCTION", areaHa: 50, priceUsd: 2000 }),
  obj({ id: "c", name: { uz: "Mehmonxona" }, regionId: "r2", category: "tourism", status: "TAKEN", areaHa: 2, priceUsd: null }),
  obj({ id: "d", name: { uz: "Quyosh stansiyasi" }, category: "energy", status: "RESERVED", areaHa: 120, priceUsd: 9000 }),
];

const f = (over: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...over });
const ids = (list: MapObject[]) => list.map((o) => o.id);

describe("geometry", () => {
  it("accepts closed polygons and multipolygons", () => {
    expect(regionGeometrySchema.safeParse(square(0, 0)).success).toBe(true);
    expect(regionGeometrySchema.safeParse({ type: "MultiPolygon", coordinates: [square(0, 0).coordinates, square(5, 5).coordinates] }).success).toBe(true);
  });

  it("rejects open rings, out-of-range coordinates and other geometry types", () => {
    expect(regionGeometrySchema.safeParse({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }).success).toBe(false);
    expect(regionGeometrySchema.safeParse(square(200, 0)).success).toBe(false);
    expect(regionGeometrySchema.safeParse(square(0, 95)).success).toBe(false);
    expect(regionGeometrySchema.safeParse({ type: "Point", coordinates: [0, 0] }).success).toBe(false);
    expect(regionGeometrySchema.safeParse({ type: "Polygon", coordinates: [] }).success).toBe(false);
  });

  it("computes bounding boxes", () => {
    expect(bboxOf(square(69, 41, 2))).toEqual([69, 41, 71, 43]);
    expect(bboxOf({ type: "MultiPolygon", coordinates: [square(0, 0).coordinates, square(10, 20, 3).coordinates] })).toEqual([0, 0, 13, 23]);
  });
});

describe("URL state", () => {
  it("round-trips filters", () => {
    const filters = f({ q: "zavod", categories: ["industry", "energy"], statuses: ["AUCTION"], areaMin: 1, areaMax: 100, priceMax: 5000, region: "r1" });
    const parsed = parseFilters(new URLSearchParams(serializeFilters(filters)));
    expect(parsed).toEqual(filters);
  });

  it("produces an empty query for default filters", () => {
    expect(serializeFilters(EMPTY_FILTERS)).toBe("");
    expect(parseFilters(new URLSearchParams(""))).toEqual(EMPTY_FILTERS);
  });

  it("ignores junk values instead of failing", () => {
    const p = parseFilters(new URLSearchParams("cat=industry,hax,industry&status=NOPE&areaMin=abc&areaMax=-5&priceMax=1e400&region=<script>"));
    expect(p.categories).toEqual(["industry"]);
    expect(p.statuses).toEqual([]);
    expect(p.areaMin).toBeNull();
    expect(p.areaMax).toBeNull();
    expect(p.priceMax).toBeNull();
    expect(p.region).toBeNull();
  });

  it("caps the query length", () => {
    expect(parseFilters(new URLSearchParams({ q: "x".repeat(500) })).q).toHaveLength(100);
  });

  it("counts active filters (not search or region)", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ categories: ["industry"], areaMin: 1, areaMax: 5, priceMax: 3, q: "x", region: "r1" }))).toBe(3);
  });
});

describe("search text", () => {
  it("normalizes accents and Uzbek apostrophes", () => {
    expect(normalize("Oʻzbek  BOGʻI")).toBe("ozbek bogi");
    expect(normalize("O‘zbek")).toBe(normalize("O'zbek"));
    expect(normalize("Café")).toBe("cafe");
  });

  it("matches regardless of apostrophe style", () => {
    expect(matchesQuery("Oʻzbek zavodi", "o'zbek")).toBe(true);
    expect(matchesQuery("Oʻzbek zavodi", "ozbek")).toBe(true);
    expect(matchesQuery("Oʻzbek zavodi", "xyz")).toBe(false);
    expect(matchesQuery("anything", "")).toBe(true);
  });

  it("ranks prefix matches first and mixes regions with objects", () => {
    const res = searchItems(regions, objects, "m", "uz");
    expect(res.map((r) => r.label)).toEqual(["Meva bogʻi", "Mehmonxona", "Samarqand"]);
    expect(res.map((r) => r.type)).toEqual(["object", "object", "region"]);
    const prefix = searchItems(regions, objects, "mev", "uz");
    expect(prefix).toEqual([{ type: "object", id: "b", label: "Meva bogʻi", regionId: "r2" }]);
  });

  it("returns nothing for blank queries and respects the limit", () => {
    expect(searchItems(regions, objects, "  ", "uz")).toEqual([]);
    expect(searchItems(regions, objects, "o", "uz", 2)).toHaveLength(2);
  });

  it("finds items by a name in any language but labels them in the active one", () => {
    expect(searchItems(regions, objects, "Ташкент", "uz").map((r) => r.label)).toEqual(["Toshkent"]);
    const res = searchItems(regions, objects, "samarqand", "ru");
    expect(res).toEqual([{ type: "region", id: "r2", label: "Самарканд" }]);
  });
});

describe("filtering", () => {
  it("returns everything for empty filters", () => {
    expect(ids(filterObjects(objects, EMPTY_FILTERS))).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by category, status and region together (AND)", () => {
    expect(ids(filterObjects(objects, f({ categories: ["industry", "tourism"] })))).toEqual(["a", "c"]);
    expect(ids(filterObjects(objects, f({ statuses: ["AUCTION", "TAKEN"] })))).toEqual(["b", "c"]);
    expect(ids(filterObjects(objects, f({ region: "r2", statuses: ["TAKEN"] })))).toEqual(["c"]);
  });

  it("filters by area range inclusively", () => {
    expect(ids(filterObjects(objects, f({ areaMin: 5, areaMax: 50 })))).toEqual(["a", "b"]);
    expect(ids(filterObjects(objects, f({ areaMin: 200 })))).toEqual([]);
  });

  it("price cap excludes objects without a price", () => {
    expect(ids(filterObjects(objects, f({ priceMax: 2000 })))).toEqual(["a", "b"]);
  });

  it("filters by name text with apostrophe tolerance", () => {
    expect(ids(filterObjects(objects, f({ q: "bogi" })))).toEqual(["b"]);
    expect(ids(filterObjects(objects, f({ q: "узбек" })))).toEqual(["a"]);
  });

  it("summarizes a region", () => {
    expect(regionSummary("r2", objects)).toEqual({ count: 2, available: 0, totalAreaHa: 52 });
    expect(regionSummary("missing", objects)).toEqual({ count: 0, available: 0, totalAreaHa: 0 });
  });
});

describe("GeoJSON builders", () => {
  it("builds point features with [lng, lat] order", () => {
    const fc = objectsToGeoJSON([objects[0]], "ru");
    expect(fc.features[0].geometry.coordinates).toEqual([69.2, 41.3]);
    expect(fc.features[0].properties).toMatchObject({ id: "a", name: "Узбекский завод", status: "AVAILABLE", category: "industry" });
  });

  it("builds region features with localized names", () => {
    const fc = regionsToGeoJSON(regions, "ru");
    expect(fc.features.map((x) => x.properties.name)).toEqual(["Ташкент", "Самарканд"]);
    expect(regionsToGeoJSON(regions, "oz").features[0].properties.name).toBe("Toshkent"); // falls back to uz
  });
});
