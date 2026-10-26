import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";

let role = "SUPER_ADMIN";
let userId = "";
let signedIn = true;

vi.mock("@/lib/auth", () => ({
  requirePermission: async (_lang: string, resource: never, action: never) => {
    if (!can(role, resource, action)) throw new Error("FORBIDDEN");
    return { id: userId, email: "admin@investmap.local", fullName: "Test", role };
  },
  getCurrentUser: async () => (signedIn ? { id: userId, email: "admin@investmap.local", fullName: "Test", role } : null),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.77" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, updateTag: () => undefined }));

const actions = await import("./map-actions");
const { GET: exportGeoJSON } = await import("@/app/api/map/export/route");

const L = (uz: string, ru = "") => ({ uz, oz: "", ru, en: "" });
const square = (x = 60, y = 40, s = 1) => ({ type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
const bowtie = { type: "Polygon", coordinates: [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]] };

const startedAt = new Date();
const tag = `IT-${Date.now()}`;
const mediaIds: string[] = [];

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: "admin@investmap.local" } })).id;
});
beforeEach(() => {
  role = "SUPER_ADMIN";
  signedIn = true;
});
afterAll(async () => {
  const mine = { createdAt: { gte: startedAt } };
  await db.planOverlay.deleteMany({ where: { name: { path: ["uz"], string_starts_with: tag } } });
  await db.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
  await db.region.deleteMany({ where: { name: { path: ["uz"], string_starts_with: tag } } });
  await db.road.deleteMany({ where: { name: { path: ["uz"], string_starts_with: tag } } });
  await db.stop.deleteMany({ where: { name: { path: ["uz"], string_starts_with: tag } } });
  await db.auditLog.deleteMany({ where: { ...mine, ip: "203.0.113.77" } });
  await db.$disconnect();
});

const regionInput = (over: Record<string, unknown> = {}) => ({
  name: L(`${tag} region`, "Район"),
  description: L(""),
  status: "PUBLISHED",
  geometry: square(),
  ...over,
});

describe("regions", () => {
  it("creates with computed centre, audits, updates and deletes", async () => {
    const created = await actions.saveRegion("en", null, regionInput());
    if (!created.ok) throw new Error(created.error);
    const row = await db.region.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.slug).toMatch(/^region-[0-9a-f]{8}$/);
    expect(row.centerLng).toBeCloseTo(60.5);
    expect(row.centerLat).toBeCloseTo(40.5);
    expect(await db.auditLog.count({ where: { entityId: created.id, action: "region.create", userId } })).toBe(1);

    const updated = await actions.saveRegion("en", created.id, regionInput({ geometry: square(70, 30, 2), name: L(`${tag} moved`) }));
    expect(updated).toEqual({ ok: true, id: created.id });
    const moved = await db.region.findUniqueOrThrow({ where: { id: created.id } });
    expect(moved.centerLng).toBeCloseTo(71);
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: created.id, action: "region.update" } });
    expect((log.before as { slug: string }).slug).toBe(row.slug);

    expect(await actions.deleteRegion("en", created.id)).toEqual({ ok: true, id: created.id });
    expect(await db.region.findUnique({ where: { id: created.id } })).toBeNull();
    expect(await actions.deleteRegion("en", created.id)).toEqual({ ok: false, error: "notFound" });
  });

  it("rejects bad geometry with a specific reason and stores nothing", async () => {
    const before = await db.region.count();
    expect(await actions.saveRegion("en", null, regionInput({ geometry: bowtie }))).toEqual({ ok: false, error: "self_intersection" });
    expect(await actions.saveRegion("en", null, regionInput({ geometry: { type: "Point", coordinates: [1, 1] } }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveRegion("en", null, regionInput({ geometry: null }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveRegion("en", null, regionInput({ name: L("") }))).toEqual({ ok: false, error: "nameRequired" });
    expect(await actions.saveRegion("en", "missing", regionInput())).toEqual({ ok: false, error: "notFound" });
    expect(await db.region.count()).toBe(before);
  });

  it("allows an unnamed draft", async () => {
    const r = await actions.saveRegion("en", null, regionInput({ name: L(`${tag} draft`), status: "DRAFT" }));
    expect(r.ok).toBe(true);
  });

  it("enforces map permissions on the server", async () => {
    role = "CONTENT_EDITOR";
    await expect(actions.saveRegion("en", null, regionInput())).rejects.toThrow("FORBIDDEN");
    role = "REQUEST_MANAGER";
    await expect(actions.deleteRegion("en", "x")).rejects.toThrow("FORBIDDEN");
    role = "MAP_EDITOR";
    const r = await actions.saveRegion("en", null, regionInput({ name: L(`${tag} by map editor`) }));
    expect(r.ok).toBe(true);
  });
});

describe("roads and stops", () => {
  it("saves a road and rejects too-short lines", async () => {
    const ok = await actions.saveRoad("en", null, { name: L(`${tag} road`), kind: "rail", status: "PUBLISHED", geometry: { type: "LineString", coordinates: [[60, 40], [61, 41]] } });
    if (!ok.ok) throw new Error(ok.error);
    expect((await db.road.findUniqueOrThrow({ where: { id: ok.id } })).kind).toBe("rail");

    const bad = await actions.saveRoad("en", null, { name: L(`${tag} bad`), kind: "road", status: "DRAFT", geometry: { type: "LineString", coordinates: [[60, 40]] } });
    expect(bad).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveRoad("en", null, { name: L(`${tag} bad kind`), kind: "monorail", status: "DRAFT", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } })).toEqual({ ok: false, error: "invalid" });
    expect(await actions.deleteRoad("en", ok.id)).toEqual({ ok: true, id: ok.id });
  });

  it("saves a stop with coordinates and validates range", async () => {
    const ok = await actions.saveStop("en", null, { name: L(`${tag} stop`), kind: "bus", status: "PUBLISHED", point: { type: "Point", coordinates: [69.2, 41.3] } });
    if (!ok.ok) throw new Error(ok.error);
    expect(await db.stop.findUniqueOrThrow({ where: { id: ok.id } })).toMatchObject({ lng: 69.2, lat: 41.3, kind: "bus" });
    expect(await actions.saveStop("en", null, { name: L(`${tag} off-planet`), kind: "bus", status: "DRAFT", point: { type: "Point", coordinates: [300, 0] } })).toEqual({ ok: false, error: "invalid" });
    expect(await actions.deleteStop("en", ok.id)).toEqual({ ok: true, id: ok.id });
  });
});

describe("plan overlays", () => {
  const corners = [[60, 41], [61, 41], [61, 40], [60, 40]];

  async function media(mimeType: string) {
    const m = await db.mediaAsset.create({ data: { key: `it/${tag}-${Math.random()}`, filename: "plan", mimeType, size: 1 } });
    mediaIds.push(m.id);
    return m;
  }

  it("pins an image plan, validates corners and blocks deleting its image", async () => {
    const img = await media("image/png");
    const ok = await actions.savePlan("en", null, { name: L(`${tag} plan`), mediaId: img.id, corners, opacity: 0.5, status: "PUBLISHED" });
    if (!ok.ok) throw new Error(ok.error);
    expect((await db.planOverlay.findUniqueOrThrow({ where: { id: ok.id } })).opacity).toBe(0.5);

    await expect(db.mediaAsset.delete({ where: { id: img.id } })).rejects.toMatchObject({ code: "P2003" });

    const base = { name: L(`${tag} plan 2`), mediaId: img.id, opacity: 0.5, status: "DRAFT" };
    expect(await actions.savePlan("en", null, { ...base, corners: [[0, 2], [2, 0], [2, 2], [0, 0]] })).toEqual({ ok: false, error: "corners_bowtie" });
    expect(await actions.savePlan("en", null, { ...base, corners: [[0, 0], [1, 1], [2, 2], [3, 3]] })).toEqual({ ok: false, error: "corners_degenerate" });
    expect(await actions.savePlan("en", null, { ...base, corners: [[0, 0]] })).toEqual({ ok: false, error: "corners_invalid" });
    expect(await actions.savePlan("en", null, { ...base, corners, opacity: 5 })).toEqual({ ok: false, error: "invalid" });

    expect(await actions.deletePlan("en", ok.id)).toEqual({ ok: true, id: ok.id });
  });

  it("keeps an image that a plan still uses, and deletes it once the plan is gone", async () => {
    const { deleteMedia } = await import("./cms-actions");
    const img = await media("image/png");
    const plan = await actions.savePlan("en", null, { name: L(`${tag} pinned`), mediaId: img.id, corners, opacity: 0.5, status: "DRAFT" });
    if (!plan.ok) throw new Error(plan.error);

    expect(await deleteMedia("en", img.id)).toEqual({ ok: false, error: "mediaInUsePlan" });
    expect(await db.mediaAsset.findUnique({ where: { id: img.id } })).not.toBeNull();

    await actions.deletePlan("en", plan.id);
    expect(await deleteMedia("en", img.id)).toEqual({ ok: true });
    expect(await db.mediaAsset.findUnique({ where: { id: img.id } })).toBeNull();
    expect(await deleteMedia("en", img.id)).toEqual({ ok: false, error: "notFound" });
  });

  it("refuses non-image media and unknown media", async () => {
    const pdf = await media("application/pdf");
    const base = { name: L(`${tag} plan 3`), corners, opacity: 0.7, status: "DRAFT" };
    expect(await actions.savePlan("en", null, { ...base, mediaId: pdf.id })).toEqual({ ok: false, error: "planNeedsImage" });
    expect(await actions.savePlan("en", null, { ...base, mediaId: "nope" })).toEqual({ ok: false, error: "planNeedsImage" });
  });
});

describe("GeoJSON import and export", () => {
  const fc = (...features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });
  const feat = (geometry: unknown, properties: unknown) => ({ type: "Feature", geometry, properties });

  it("imports valid features as drafts, skips bad ones and audits once", async () => {
    const text = fc(
      feat(square(10, 10), { name: `${tag} imported region` }),
      feat(bowtie, { name: `${tag} broken` }),
      feat({ type: "LineString", coordinates: [[10, 10], [11, 11]] }, { name: `${tag} imported road` }),
      feat({ type: "Point", coordinates: [10.5, 10.5] }, { name: `${tag} imported stop`, kind: "train" }),
    );
    const res = await actions.importGeoJSON("en", text);
    expect(res).toMatchObject({ ok: true, regions: 1, roads: 1, stops: 1 });
    if (res.ok) expect(res.issues).toEqual([{ index: 1, reason: "self_intersection" }]);

    const region = await db.region.findFirstOrThrow({ where: { name: { path: ["uz"], equals: `${tag} imported region` } } });
    expect(region.status).toBe("DRAFT");
    expect(await db.road.count({ where: { name: { path: ["uz"], equals: `${tag} imported road` }, status: "DRAFT" } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "map.import", ip: "203.0.113.77" } })).toBe(1);
  });

  it("reports unusable files and requires permission", async () => {
    expect(await actions.importGeoJSON("en", "nope")).toEqual({ ok: false, error: "import_not_json" });
    expect(await actions.importGeoJSON("en", fc())).toEqual({ ok: false, error: "import_nothing" });
    role = "INVESTOR";
    await expect(actions.importGeoJSON("en", fc())).rejects.toThrow("FORBIDDEN");
  });

  it("exports everything for staff and refuses guests and non-staff", async () => {
    const res = await exportGeoJSON();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const body = await res.json();
    expect(body.type).toBe("FeatureCollection");
    const layers = new Set(body.features.map((f: { properties: { layer: string } }) => f.properties.layer));
    expect(layers.has("region")).toBe(true);

    signedIn = false;
    expect((await exportGeoJSON()).status).toBe(401);
    signedIn = true;
    role = "INVESTOR";
    expect((await exportGeoJSON()).status).toBe(403);
  });
});
