import { z } from "zod";
import { pickLocalized } from "@/lib/content";
import type { Locale } from "@/i18n/config";

export const OBJECT_CATEGORIES = ["industry", "agriculture", "tourism", "energy", "logistics", "services"] as const;
export type ObjectCategory = (typeof OBJECT_CATEGORIES)[number];

export const OBJECT_STATUSES = ["AVAILABLE", "RESERVED", "AUCTION", "TAKEN"] as const;
export type ObjectStatusKey = (typeof OBJECT_STATUSES)[number];

type Localized = Partial<Record<Locale, string>>;
type Position = [number, number];

export type MapRegion = {
  id: string;
  slug: string;
  name: Localized;
  description: Localized;
  geometry: PolygonGeometry;
  center: Position;
};

export type MapObject = {
  id: string;
  slug: string;
  regionId: string;
  name: Localized;
  description: Localized;
  category: ObjectCategory;
  status: ObjectStatusKey;
  areaHa: number;
  priceUsd: number | null;
  lng: number;
  lat: number;
  /** Nearest published auction that has not finished yet. */
  auction?: { startsAt: string; endsAt: string; startPriceUsd: number; status: "SCHEDULED" | "OPEN" };
};

export type MapRoad = {
  id: string;
  name: Localized;
  kind: "road" | "rail";
  geometry: { type: "LineString"; coordinates: Position[] };
};

export type MapStop = {
  id: string;
  name: Localized;
  kind: "bus" | "train" | "other";
  lng: number;
  lat: number;
};

export type MapPlan = {
  id: string;
  name: Localized;
  imageUrl: string;
  corners: [Position, Position, Position, Position];
  opacity: number;
};

// ---------- geometry ----------

const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);
// GIS exports often carry altitude as a third value; the map only needs [lng, lat].
const position = z.tuple([lng, lat], z.number()).transform(([x, y]): [number, number] => [x, y]);
const ring = z.array(position).min(4).refine((r) => {
  const a = r[0];
  const b = r[r.length - 1];
  return a[0] === b[0] && a[1] === b[1];
}, "ring must be closed");

export const polygonSchema = z.object({ type: z.literal("Polygon"), coordinates: z.array(ring).min(1) });
export const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(ring).min(1)).min(1),
});
export const regionGeometrySchema = z.union([polygonSchema, multiPolygonSchema]);
export type PolygonGeometry = z.infer<typeof regionGeometrySchema>;

/** [west, south, east, north] of a polygon or multipolygon. */
export function bboxOf(geometry: PolygonGeometry): [number, number, number, number] {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const r of rings) {
    for (const [x, y] of r) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  }
  return [w, s, e, n];
}

// ---------- filters & URL state ----------

export type Filters = {
  q: string;
  categories: ObjectCategory[];
  statuses: ObjectStatusKey[];
  areaMin: number | null;
  areaMax: number | null;
  priceMax: number | null;
  region: string | null;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  categories: [],
  statuses: [],
  areaMin: null,
  areaMax: null,
  priceMax: null,
  region: null,
};

const num = (v: string | null) => {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : null;
};

const list = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
  (v ?? "")
    .split(",")
    .filter((x): x is T => (allowed as readonly string[]).includes(x))
    .filter((x, i, arr) => arr.indexOf(x) === i);

/** Reads filters from a URL query; anything invalid is ignored rather than rejected. */
export function parseFilters(params: Pick<URLSearchParams, "get">): Filters {
  const region = params.get("region");
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    categories: list(params.get("cat"), OBJECT_CATEGORIES),
    statuses: list(params.get("status"), OBJECT_STATUSES),
    areaMin: num(params.get("areaMin")),
    areaMax: num(params.get("areaMax")),
    priceMax: num(params.get("priceMax")),
    region: region && /^[a-z0-9]{1,40}$/i.test(region) ? region : null,
  };
}

export function serializeFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.categories.length) p.set("cat", f.categories.join(","));
  if (f.statuses.length) p.set("status", f.statuses.join(","));
  if (f.areaMin !== null) p.set("areaMin", String(f.areaMin));
  if (f.areaMax !== null) p.set("areaMax", String(f.areaMax));
  if (f.priceMax !== null) p.set("priceMax", String(f.priceMax));
  if (f.region) p.set("region", f.region);
  return p.toString();
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.categories.length ? 1 : 0) +
    (f.statuses.length ? 1 : 0) +
    (f.areaMin !== null || f.areaMax !== null ? 1 : 0) +
    (f.priceMax !== null ? 1 : 0)
  );
}

// ---------- search ----------

/** Lowercases, strips accents and unifies the apostrophe variants used in Uzbek Latin (oʻ, o‘, o'). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʻʼ‘’`´']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every non-empty translation of a name, so people can search in any language they know. */
export function nameVariants(name: Localized): string[] {
  return Object.values(name).filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

export function matchesQuery(name: string | string[], query: string): boolean {
  const q = normalize(query);
  if (q === "") return true;
  return (Array.isArray(name) ? name : [name]).some((n) => normalize(n).includes(q));
}

export type SearchResult = { type: "region" | "object"; id: string; label: string; regionId?: string };

export function searchItems(
  regions: MapRegion[],
  objects: MapObject[],
  query: string,
  locale: Locale,
  limit = 8,
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { score: number; result: SearchResult }[] = [];
  const consider = (variants: string[], result: SearchResult, extra = 0) => {
    let best = Infinity;
    for (const v of variants) {
      const n = normalize(v);
      const idx = n.indexOf(q);
      if (idx === -1) continue;
      best = Math.min(best, (idx === 0 ? 0 : 10) + n.length / 1000);
    }
    if (best !== Infinity) scored.push({ score: best + extra, result });
  };
  for (const r of regions) {
    const label = pickLocalized(r.name, locale).text;
    consider(nameVariants(r.name), { type: "region", id: r.id, label });
  }
  for (const o of objects) {
    const label = pickLocalized(o.name, locale).text;
    consider(nameVariants(o.name), { type: "object", id: o.id, label, regionId: o.regionId }, 1);
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.result);
}

// ---------- filtering ----------

export function filterObjects(objects: MapObject[], f: Filters): MapObject[] {
  return objects.filter((o) => {
    if (f.region && o.regionId !== f.region) return false;
    if (f.categories.length && !f.categories.includes(o.category)) return false;
    if (f.statuses.length && !f.statuses.includes(o.status)) return false;
    if (f.areaMin !== null && o.areaHa < f.areaMin) return false;
    if (f.areaMax !== null && o.areaHa > f.areaMax) return false;
    if (f.priceMax !== null && (o.priceUsd === null || o.priceUsd > f.priceMax)) return false;
    if (f.q && !matchesQuery(nameVariants(o.name), f.q)) return false;
    return true;
  });
}

export function regionSummary(regionId: string, objects: MapObject[]) {
  const own = objects.filter((o) => o.regionId === regionId);
  return {
    count: own.length,
    available: own.filter((o) => o.status === "AVAILABLE").length,
    totalAreaHa: Math.round(own.reduce((s, o) => s + o.areaHa, 0) * 10) / 10,
  };
}

// ---------- GeoJSON for the map sources ----------

export function objectsToGeoJSON(objects: MapObject[], locale: Locale) {
  return {
    type: "FeatureCollection" as const,
    features: objects.map((o) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [o.lng, o.lat] as Position },
      properties: { id: o.id, name: pickLocalized(o.name, locale).text, status: o.status, category: o.category },
    })),
  };
}

export function regionsToGeoJSON(regions: MapRegion[], locale: Locale) {
  return {
    type: "FeatureCollection" as const,
    features: regions.map((r) => ({
      type: "Feature" as const,
      geometry: r.geometry,
      properties: { id: r.id, name: pickLocalized(r.name, locale).text },
    })),
  };
}

export function roadsToGeoJSON(roads: MapRoad[], locale: Locale) {
  return {
    type: "FeatureCollection" as const,
    features: roads.map((r) => ({
      type: "Feature" as const,
      geometry: r.geometry,
      properties: { id: r.id, kind: r.kind, name: pickLocalized(r.name, locale).text },
    })),
  };
}

export function stopsToGeoJSON(stops: MapStop[], locale: Locale) {
  return {
    type: "FeatureCollection" as const,
    features: stops.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] as Position },
      properties: { id: s.id, kind: s.kind, name: pickLocalized(s.name, locale).text },
    })),
  };
}

export const STATUS_COLORS: Record<ObjectStatusKey, string> = {
  AVAILABLE: "#16a34a",
  RESERVED: "#d97706",
  AUCTION: "#7c3aed",
  TAKEN: "#6b7280",
};
