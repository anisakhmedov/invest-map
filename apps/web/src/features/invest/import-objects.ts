import { normalize } from "@/features/map/model";
import { objectInputSchema, type ObjectInput } from "./schemas";

export type RegionRef = { id: string; slug: string; names: string[] };
export type ImportRowError = { row: number; field: string; code: string };
export type ImportedObject = { row: number; slug: string | null; input: ObjectInput };

export type ImportAnalysis = {
  objects: ImportedObject[];
  errors: ImportRowError[];
  ignoredColumns: string[];
  /** Recognised columns present in the file, so updates only touch what the file actually provides. */
  columns: string[];
};

const ALIASES: Record<string, string> = {
  name: "name_uz",
  description: "description_uz",
  area: "area_ha",
  ha: "area_ha",
  price: "price_usd",
  latitude: "lat",
  longitude: "lng",
  lon: "lng",
  long: "lng",
  phone: "contact_phone",
  email: "contact_email",
  contact: "contact_name",
  published: "publish",
};

const KNOWN = new Set([
  "slug", "region", "category", "status", "publish", "area_ha", "price_usd", "lng", "lat",
  "name_uz", "name_oz", "name_ru", "name_en",
  "description_uz", "description_oz", "description_ru", "description_en",
  "contact_name", "contact_phone", "contact_email",
]);
const REQUIRED = ["name_uz", "region", "category", "area_ha", "lng", "lat"];

export function normalizeHeader(h: string): string {
  const key = h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s\-.]+/g, "_");
  return ALIASES[key] ?? key;
}

/** "1 500", "1,5" and "1,500.25" all become numbers; anything else is NaN. Empty cells give null. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/[\s ]/g, "");
  if (s === "") return null;
  let t = s;
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else if (t.includes(",")) t = t.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const TRUE = new Set(["published", "publish", "yes", "true", "1", "da", "ha", "да"]);

export function analyzeObjectCsv(
  rows: string[][],
  regions: RegionRef[],
): ImportAnalysis | { fatal: "missing_columns"; missing: string[] } {
  const header = rows[0].map(normalizeHeader);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { fatal: "missing_columns", missing };

  const index = new Map<string, number>();
  header.forEach((h, i) => {
    if (KNOWN.has(h) && !index.has(h)) index.set(h, i);
  });
  const ignoredColumns = header.filter((h) => h !== "" && !KNOWN.has(h));

  const byKey = new Map<string, string>();
  for (const r of regions) {
    byKey.set(normalize(r.slug), r.id);
    for (const n of r.names) byKey.set(normalize(n), r.id);
  }

  const result: ImportAnalysis = { objects: [], errors: [], ignoredColumns, columns: [...index.keys()] };
  const seenSlugs = new Set<string>();

  rows.slice(1).forEach((cells, i) => {
    const row = i + 2; // spreadsheet-style numbering: header is row 1
    const get = (col: string) => (index.has(col) ? (cells[index.get(col)!] ?? "").trim() : "");
    const fail = (field: string, code: string) => result.errors.push({ row, field, code });

    const regionId = byKey.get(normalize(get("region")));
    if (!regionId) return fail("region", "unknown_region");

    const area = parseNumber(get("area_ha"));
    const price = parseNumber(get("price_usd"));
    const lng = parseNumber(get("lng"));
    const lat = parseNumber(get("lat"));
    if (area === null || Number.isNaN(area)) return fail("area_ha", "invalid_number");
    if (Number.isNaN(price)) return fail("price_usd", "invalid_number");
    if (lng === null || Number.isNaN(lng)) return fail("lng", "invalid_number");
    if (lat === null || Number.isNaN(lat)) return fail("lat", "invalid_number");

    const slugRaw = get("slug").toLowerCase();
    if (slugRaw && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugRaw)) return fail("slug", "invalid_slug");
    if (slugRaw && seenSlugs.has(slugRaw)) return fail("slug", "duplicate_slug");

    const parsed = objectInputSchema.safeParse({
      regionId,
      name: { uz: get("name_uz"), oz: get("name_oz"), ru: get("name_ru"), en: get("name_en") },
      description: { uz: get("description_uz"), oz: get("description_oz"), ru: get("description_ru"), en: get("description_en") },
      category: get("category").toLowerCase(),
      status: (get("status") || "AVAILABLE").toUpperCase(),
      areaHa: area,
      priceUsd: price,
      lng,
      lat,
      publish: TRUE.has(get("publish").toLowerCase()) ? "PUBLISHED" : "DRAFT",
      contactName: get("contact_name"),
      contactPhone: get("contact_phone"),
      contactEmail: get("contact_email"),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue.path[issue.path.length - 1] ?? issue.path[0] ?? "row");
      return fail(field, issue.message === "name_required" ? "name_required" : "invalid_value");
    }

    if (slugRaw) seenSlugs.add(slugRaw);
    result.objects.push({ row, slug: slugRaw || null, input: parsed.data });
  });

  return result;
}

export const EXPORT_HEADER = [
  "slug", "region", "name_uz", "name_oz", "name_ru", "name_en", "category", "status", "area_ha", "price_usd",
  "lng", "lat", "publish", "contact_name", "contact_phone", "contact_email",
];

const LANGS = ["uz", "oz", "ru", "en"] as const;

/** Keeps the languages the file has no column for, and overwrites the ones it does. */
export function mergeLocalized(
  existing: unknown,
  incoming: Record<(typeof LANGS)[number], string>,
  columns: readonly string[],
  prefix: "name" | "description",
): Record<string, string> {
  const base = (existing && typeof existing === "object" ? existing : {}) as Record<string, string>;
  const out: Record<string, string> = { uz: "", oz: "", ru: "", en: "" };
  for (const l of LANGS) out[l] = columns.includes(`${prefix}_${l}`) ? incoming[l] : (base[l] ?? "");
  return out;
}
