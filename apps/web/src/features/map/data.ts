import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { cornersSchema, lineStringSchema } from "./geo";
import {
  OBJECT_CATEGORIES,
  regionGeometrySchema,
  type MapObject,
  type MapPlan,
  type MapRegion,
  type MapRoad,
  type MapStop,
  type ObjectCategory,
} from "./model";

type Localized = Partial<Record<"uz" | "oz" | "ru" | "en", string>>;
const asLocalized = (v: unknown): Localized => (v && typeof v === "object" && !Array.isArray(v) ? (v as Localized) : {});

type MapData = {
  regions: MapRegion[];
  objects: MapObject[];
  roads: MapRoad[];
  stops: MapStop[];
  plans: MapPlan[];
};

/** Cached until an admin changes map or investment data (`updateTag("public-data")`). */
export async function getMapData(): Promise<MapData> {
  "use cache";
  cacheTag("public-data");
  cacheLife("hours");
  return loadMapData();
}

/** Published map data. Rows with broken geometry or unknown categories are skipped, never thrown on. */
export async function loadMapData(): Promise<MapData> {
  const [regionRows, objectRows, roadRows, stopRows, planRows, auctionRows] = await Promise.all([
    db.region.findMany({ where: { status: "PUBLISHED" }, orderBy: { slug: "asc" } }),
    db.investObject.findMany({
      where: { publish: "PUBLISHED", region: { status: "PUBLISHED" } },
      orderBy: { slug: "asc" },
    }),
    db.road.findMany({ where: { status: "PUBLISHED" }, orderBy: { slug: "asc" } }),
    db.stop.findMany({ where: { status: "PUBLISHED" }, orderBy: { slug: "asc" } }),
    db.planOverlay.findMany({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    db.auction.findMany({
      where: { publish: "PUBLISHED", status: { in: ["SCHEDULED", "OPEN"] } },
      orderBy: { endsAt: "asc" },
      select: { objectId: true, startsAt: true, endsAt: true, startPriceUsd: true, status: true },
    }),
  ]);
  const nextAuction = new Map<string, NonNullable<MapObject["auction"]>>();
  for (const a of auctionRows) {
    if (a.status !== "SCHEDULED" && a.status !== "OPEN") continue;
    if (!nextAuction.has(a.objectId)) {
      nextAuction.set(a.objectId, { startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(), startPriceUsd: a.startPriceUsd, status: a.status });
    }
  }

  const regions: MapRegion[] = [];
  for (const r of regionRows) {
    const geometry = regionGeometrySchema.safeParse(r.geometry);
    if (!geometry.success) continue;
    regions.push({
      id: r.id,
      slug: r.slug,
      name: asLocalized(r.name),
      description: asLocalized(r.description),
      geometry: geometry.data,
      center: [r.centerLng, r.centerLat],
    });
  }

  const known = new Set(regions.map((r) => r.id));
  const objects: MapObject[] = objectRows
    .filter((o) => known.has(o.regionId) && (OBJECT_CATEGORIES as readonly string[]).includes(o.category))
    .map((o) => ({
      id: o.id,
      slug: o.slug,
      regionId: o.regionId,
      name: asLocalized(o.name),
      description: asLocalized(o.description),
      category: o.category as ObjectCategory,
      status: o.status,
      areaHa: o.areaHa,
      priceUsd: o.priceUsd,
      lng: o.lng,
      lat: o.lat,
      auction: nextAuction.get(o.id),
    }));

  const roads: MapRoad[] = roadRows.flatMap((r) => {
    const g = lineStringSchema.safeParse(r.geometry);
    return g.success ? [{ id: r.id, name: asLocalized(r.name), kind: r.kind === "rail" ? ("rail" as const) : ("road" as const), geometry: g.data }] : [];
  });

  const stops: MapStop[] = stopRows.map((s) => ({
    id: s.id,
    name: asLocalized(s.name),
    kind: s.kind === "train" ? "train" : s.kind === "other" ? "other" : "bus",
    lng: s.lng,
    lat: s.lat,
  }));

  const plans: MapPlan[] = planRows.flatMap((p) => {
    const c = cornersSchema.safeParse(p.corners);
    return c.success ? [{ id: p.id, name: asLocalized(p.name), imageUrl: `/api/media/${p.mediaId}`, corners: c.data, opacity: p.opacity }] : [];
  });

  return { regions, objects, roads, stops, plans };
}
