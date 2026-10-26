"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requestIp as ip } from "@/lib/request-ip";
import { buildAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { centroidOf, parseGeoJSONImport, validateCorners, validatePolygonGeometry } from "@/features/map/geo";
import { planInputSchema, regionInputSchema, roadInputSchema, stopInputSchema } from "@/features/map/editor-schemas";

export type EditorResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const slug = (prefix: string) => `${prefix}-${randomBytes(4).toString("hex")}`;
const loc = (lang: string) => (hasLocale(lang) ? lang : defaultLocale);

function refresh(lang: string) {
  updateTag("public-data");
  revalidatePath(`/${loc(lang)}/map`);
  revalidatePath(`/${loc(lang)}/admin/map`);
}

type Entity = "Region" | "Road" | "Stop" | "PlanOverlay";

async function audit(userId: string, action: string, entity: Entity, entityId: string, before: unknown, after: unknown) {
  await db.auditLog.create({
    data: buildAuditEntry({ userId, action, entity, entityId, before, after, ip: await ip() }),
  });
}

function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  if (issue?.message === "name_required") return "nameRequired";
  return "invalid";
}

// ---------- regions ----------

export async function saveRegion(lang: string, id: string | null, input: unknown): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.feature", id ? "update" : "create");
  const parsed = regionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = validatePolygonGeometry(parsed.data.geometry);
  if (!v.ok) return { ok: false, error: v.error };
  if (parsed.data.status === "PUBLISHED" && !can(user.role, "map.feature", "publish")) return { ok: false, error: "cannotPublish" };

  const before = id ? await db.region.findUnique({ where: { id } }) : null;
  if (id && !before) return { ok: false, error: "notFound" };

  const [centerLng, centerLat] = centroidOf(v.geometry);
  const data = {
    name: parsed.data.name,
    description: parsed.data.description,
    status: parsed.data.status,
    geometry: v.geometry,
    centerLng,
    centerLat,
  };
  const saved = id
    ? await db.region.update({ where: { id }, data })
    : await db.region.create({ data: { ...data, slug: slug("region") } });
  await audit(user.id, id ? "region.update" : "region.create", "Region", saved.id, before, saved);
  refresh(lang);
  return { ok: true, id: saved.id };
}

export async function deleteRegion(lang: string, id: string): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.feature", "delete");
  const before = await db.region.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  // Objects (and their auction lots) belong to a region and would be deleted with it. Make the
  // editor move or delete them first, so nothing disappears without its own audit entry.
  if ((await db.investObject.count({ where: { regionId: id } })) > 0) return { ok: false, error: "regionHasObjects" };
  await db.region.delete({ where: { id } });
  await audit(user.id, "region.delete", "Region", id, before, null);
  refresh(lang);
  return { ok: true, id };
}

// ---------- roads ----------

export async function saveRoad(lang: string, id: string | null, input: unknown): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.feature", id ? "update" : "create");
  const parsed = roadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (parsed.data.status === "PUBLISHED" && !can(user.role, "map.feature", "publish")) return { ok: false, error: "cannotPublish" };

  const before = id ? await db.road.findUnique({ where: { id } }) : null;
  if (id && !before) return { ok: false, error: "notFound" };

  const data = { name: parsed.data.name, kind: parsed.data.kind, status: parsed.data.status, geometry: parsed.data.geometry };
  const saved = id ? await db.road.update({ where: { id }, data }) : await db.road.create({ data: { ...data, slug: slug("road") } });
  await audit(user.id, id ? "road.update" : "road.create", "Road", saved.id, before, saved);
  refresh(lang);
  return { ok: true, id: saved.id };
}

export async function deleteRoad(lang: string, id: string): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.feature", "delete");
  const before = await db.road.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  await db.road.delete({ where: { id } });
  await audit(user.id, "road.delete", "Road", id, before, null);
  refresh(lang);
  return { ok: true, id };
}

// ---------- stops ----------

export async function saveStop(lang: string, id: string | null, input: unknown): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.feature", id ? "update" : "create");
  const parsed = stopInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (parsed.data.status === "PUBLISHED" && !can(user.role, "map.feature", "publish")) return { ok: false, error: "cannotPublish" };

  const before = id ? await db.stop.findUnique({ where: { id } }) : null;
  if (id && !before) return { ok: false, error: "notFound" };

  const [lng, lat] = parsed.data.point.coordinates;
  const data = { name: parsed.data.name, kind: parsed.data.kind, status: parsed.data.status, lng, lat };
  const saved = id ? await db.stop.update({ where: { id }, data }) : await db.stop.create({ data: { ...data, slug: slug("stop") } });
  await audit(user.id, id ? "stop.update" : "stop.create", "Stop", saved.id, before, saved);
  refresh(lang);
  return { ok: true, id: saved.id };
}

export async function deleteStop(lang: string, id: string): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.feature", "delete");
  const before = await db.stop.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  await db.stop.delete({ where: { id } });
  await audit(user.id, "stop.delete", "Stop", id, before, null);
  refresh(lang);
  return { ok: true, id };
}

// ---------- plan overlays ----------

export async function savePlan(lang: string, id: string | null, input: unknown): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.layer", id ? "update" : "create");
  const parsed = planInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const corners = validateCorners(parsed.data.corners);
  if (!corners.ok) return { ok: false, error: `corners_${corners.error}` };
  if (parsed.data.status === "PUBLISHED" && !can(user.role, "map.layer", "publish")) return { ok: false, error: "cannotPublish" };

  const media = await db.mediaAsset.findUnique({ where: { id: parsed.data.mediaId } });
  if (!media || !media.mimeType.startsWith("image/")) return { ok: false, error: "planNeedsImage" };

  const before = id ? await db.planOverlay.findUnique({ where: { id } }) : null;
  if (id && !before) return { ok: false, error: "notFound" };

  const data = {
    name: parsed.data.name,
    mediaId: media.id,
    corners: corners.corners,
    opacity: parsed.data.opacity,
    status: parsed.data.status,
  };
  const saved = id ? await db.planOverlay.update({ where: { id }, data }) : await db.planOverlay.create({ data });
  await audit(user.id, id ? "plan.update" : "plan.create", "PlanOverlay", saved.id, before, saved);
  refresh(lang);
  return { ok: true, id: saved.id };
}

export async function deletePlan(lang: string, id: string): Promise<EditorResult> {
  const user = await requirePermission(lang, "map.layer", "delete");
  const before = await db.planOverlay.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  await db.planOverlay.delete({ where: { id } });
  await audit(user.id, "plan.delete", "PlanOverlay", id, before, null);
  refresh(lang);
  return { ok: true, id };
}

// ---------- GeoJSON import ----------

export type ImportOutcome =
  | { ok: true; regions: number; roads: number; stops: number; issues: { index: number; reason: string }[] }
  | { ok: false; error: string };

/** Everything imported lands as DRAFT so nothing goes public without review. */
export async function importGeoJSON(lang: string, text: string): Promise<ImportOutcome> {
  const user = await requirePermission(lang, "map.feature", "create");
  if (typeof text !== "string") return { ok: false, error: "invalid" };
  const parsed = parseGeoJSONImport(text);
  if ("fatal" in parsed) return { ok: false, error: `import_${parsed.fatal}` };
  if (parsed.regions.length + parsed.roads.length + parsed.stops.length === 0) {
    return { ok: false, error: "import_nothing" };
  }

  await db.$transaction([
    ...parsed.regions.map((r) => {
      const [centerLng, centerLat] = centroidOf(r.geometry);
      return db.region.create({
        data: { slug: slug("region"), status: "DRAFT", name: r.name, description: r.description, geometry: r.geometry, centerLng, centerLat },
      });
    }),
    ...parsed.roads.map((r) => db.road.create({ data: { slug: slug("road"), status: "DRAFT", kind: r.kind, name: r.name, geometry: r.geometry } })),
    ...parsed.stops.map((s) => db.stop.create({ data: { slug: slug("stop"), status: "DRAFT", kind: s.kind, name: s.name, lng: s.lng, lat: s.lat } })),
  ]);

  await db.auditLog.create({
    data: buildAuditEntry({
      userId: user.id,
      action: "map.import",
      entity: "Region",
      after: { regions: parsed.regions.length, roads: parsed.roads.length, stops: parsed.stops.length, skipped: parsed.issues.length },
      ip: await ip(),
    }),
  });
  refresh(lang);
  return { ok: true, regions: parsed.regions.length, roads: parsed.roads.length, stops: parsed.stops.length, issues: parsed.issues };
}
