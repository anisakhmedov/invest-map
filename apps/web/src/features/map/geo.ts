import { z } from "zod";
import { locales } from "@/i18n/config";
import { bboxOf, regionGeometrySchema, type PolygonGeometry } from "./model";

type Position = [number, number];

// ---------- schemas ----------

const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);
// GIS exports often carry altitude as a third value; the map only needs [lng, lat].
const position = z.tuple([lng, lat], z.number()).transform(([x, y]): [number, number] => [x, y]);

export const MAX_VERTICES = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_FEATURES = 500;

export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(position).min(2).max(MAX_VERTICES),
});
export type LineGeometry = z.infer<typeof lineStringSchema>;

export const pointSchema = z.object({ type: z.literal("Point"), coordinates: position });

export const cornersSchema = z.tuple([position, position, position, position]);
export type Corners = z.infer<typeof cornersSchema>;

// ---------- geometry helpers ----------

const cross = (o: Position, a: Position, b: Position) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** True when the two segments cross at an interior point (touching ends do not count). */
function segmentsCross(a: Position, b: Position, c: Position, d: Position): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Checks a closed ring for crossing edges. O(n²), so callers cap the vertex count first. */
export function ringSelfIntersects(ring: Position[]): boolean {
  const n = ring.length - 1; // last point repeats the first
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // first and last edges share a vertex
      if (segmentsCross(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
    }
  }
  return false;
}

export function ringArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return sum / 2;
}

export type GeometryError = "too_many_vertices" | "self_intersection" | "zero_area" | "invalid";

export function validatePolygonGeometry(input: unknown): { ok: true; geometry: PolygonGeometry } | { ok: false; error: GeometryError } {
  const parsed = regionGeometrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const geometry = parsed.data;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const vertexCount = polygons.flat(2).length; // flattened to individual positions
  if (vertexCount > MAX_VERTICES) return { ok: false, error: "too_many_vertices" };
  for (const rings of polygons) {
    for (const ring of rings) {
      if (ringSelfIntersects(ring)) return { ok: false, error: "self_intersection" };
    }
    if (Math.abs(ringArea(rings[0])) === 0) return { ok: false, error: "zero_area" };
  }
  return { ok: true, geometry };
}

/** Area-weighted centre of the largest polygon; falls back to the bbox centre for degenerate input. */
export function centroidOf(geometry: PolygonGeometry): Position {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const outer = polygons.map((p) => p[0]).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
  const a = ringArea(outer);
  if (a !== 0) {
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < outer.length - 1; i++) {
      const f = outer[i][0] * outer[i + 1][1] - outer[i + 1][0] * outer[i][1];
      cx += (outer[i][0] + outer[i + 1][0]) * f;
      cy += (outer[i][1] + outer[i + 1][1]) * f;
    }
    return [cx / (6 * a), cy / (6 * a)];
  }
  const [w, s, e, n] = bboxOf(geometry);
  return [(w + e) / 2, (s + n) / 2];
}

export function cornersFromBbox([w, s, e, n]: [number, number, number, number]): Corners {
  return [[w, n], [e, n], [e, s], [w, s]];
}

/** Corners must form a simple, non-degenerate quadrilateral (no bow-tie, not a line). */
export function validateCorners(input: unknown): { ok: true; corners: Corners } | { ok: false; error: "invalid" | "degenerate" | "bowtie" } {
  const parsed = cornersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const c = parsed.data;
  // A bow-tie has near-zero signed area, so look for crossing edges first.
  if (segmentsCross(c[0], c[1], c[2], c[3]) || segmentsCross(c[1], c[2], c[3], c[0])) return { ok: false, error: "bowtie" };
  if (Math.abs(ringArea([...c, c[0]])) < 1e-12) return { ok: false, error: "degenerate" };
  return { ok: true, corners: c };
}

// ---------- GeoJSON import / export ----------

type Localized = Record<(typeof locales)[number], string>;

export type ImportedRegion = { name: Localized; description: Localized; geometry: PolygonGeometry };
export type ImportedRoad = { name: Localized; kind: "road" | "rail"; geometry: LineGeometry };
export type ImportedStop = { name: Localized; kind: "bus" | "train" | "other"; lng: number; lat: number };
export type ImportIssue = { index: number; reason: string };

export type ImportResult = {
  regions: ImportedRegion[];
  roads: ImportedRoad[];
  stops: ImportedStop[];
  issues: ImportIssue[];
};

const empty = (): Localized => ({ uz: "", oz: "", ru: "", en: "" });

function readNames(props: Record<string, unknown>, prefix: string): Localized {
  const out = empty();
  const base = props[prefix];
  if (typeof base === "string") out.uz = base.trim().slice(0, 200);
  for (const l of locales) {
    for (const key of [`${prefix}_${l}`, `${prefix}:${l}`]) {
      const v = props[key];
      if (typeof v === "string") out[l] = v.trim().slice(0, 200);
    }
  }
  return out;
}

const stopKinds = ["bus", "train", "other"] as const;
const roadKinds = ["road", "rail"] as const;

/** Parses user-supplied GeoJSON into editor entities. Bad features are reported, never thrown on. */
export function parseGeoJSONImport(text: string): ImportResult | { fatal: "too_large" | "not_json" | "not_geojson" | "too_many_features" } {
  if (text.length > MAX_IMPORT_BYTES) return { fatal: "too_large" };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { fatal: "not_json" };
  }
  if (!data || typeof data !== "object") return { fatal: "not_geojson" };
  const root = data as { type?: unknown; features?: unknown; geometry?: unknown };

  let features: unknown[];
  if (root.type === "FeatureCollection" && Array.isArray(root.features)) features = root.features;
  else if (root.type === "Feature") features = [data];
  else if (["Polygon", "MultiPolygon", "LineString", "Point"].includes(String(root.type))) features = [{ type: "Feature", properties: {}, geometry: data }];
  else return { fatal: "not_geojson" };
  if (features.length > MAX_IMPORT_FEATURES) return { fatal: "too_many_features" };

  const result: ImportResult = { regions: [], roads: [], stops: [], issues: [] };
  features.forEach((raw, index) => {
    const f = raw as { type?: unknown; geometry?: { type?: unknown } | null; properties?: Record<string, unknown> | null };
    if (!f || f.type !== "Feature" || !f.geometry) return void result.issues.push({ index, reason: "not_a_feature" });
    const props = f.properties ?? {};
    const name = readNames(props, "name");
    const g = f.geometry;

    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      const v = validatePolygonGeometry(g);
      if (!v.ok) return void result.issues.push({ index, reason: v.error });
      result.regions.push({ name, description: readNames(props, "description"), geometry: v.geometry });
    } else if (g.type === "LineString") {
      const p = lineStringSchema.safeParse(g);
      if (!p.success) return void result.issues.push({ index, reason: "invalid" });
      const kind = roadKinds.find((k) => k === props.kind) ?? "road";
      result.roads.push({ name, kind, geometry: p.data });
    } else if (g.type === "Point") {
      const p = pointSchema.safeParse(g);
      if (!p.success) return void result.issues.push({ index, reason: "invalid" });
      const kind = stopKinds.find((k) => k === props.kind) ?? "bus";
      result.stops.push({ name, kind, lng: p.data.coordinates[0], lat: p.data.coordinates[1] });
    } else {
      result.issues.push({ index, reason: "unsupported_geometry" });
    }
  });
  return result;
}

type ExportRegion = { id: string; slug: string; name: unknown; description: unknown; geometry: unknown };
type ExportRoad = { id: string; slug: string; kind: string; name: unknown; geometry: unknown };
type ExportStop = { id: string; slug: string; kind: string; name: unknown; lng: number; lat: number };

function flatNames(prefix: string, value: unknown): Record<string, string> {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const l of locales) if (typeof v[l] === "string" && v[l]) out[`${prefix}_${l}`] = v[l] as string;
  if (out[`${prefix}_uz`]) out[prefix] = out[`${prefix}_uz`];
  return out;
}

export function toFeatureCollection(data: { regions: ExportRegion[]; roads: ExportRoad[]; stops: ExportStop[] }) {
  return {
    type: "FeatureCollection" as const,
    features: [
      ...data.regions.map((r) => ({
        type: "Feature" as const,
        geometry: r.geometry,
        properties: { layer: "region", slug: r.slug, ...flatNames("name", r.name), ...flatNames("description", r.description) },
      })),
      ...data.roads.map((r) => ({
        type: "Feature" as const,
        geometry: r.geometry,
        properties: { layer: "road", slug: r.slug, kind: r.kind, ...flatNames("name", r.name) },
      })),
      ...data.stops.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { layer: "stop", slug: s.slug, kind: s.kind, ...flatNames("name", s.name) },
      })),
    ],
  };
}
