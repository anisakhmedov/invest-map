import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { parseCsv } from "@/features/invest/csv";

let role = "SUPER_ADMIN";
let userId = "";
let signedIn = true;
const denied = new Set<string>(); // "resource:action" pairs to refuse on top of the role matrix

vi.mock("@/lib/auth", () => ({
  requirePermission: async (_lang: string, resource: never, action: never) => {
    if (denied.has(`${resource}:${action}`) || !can(role, resource, action)) throw new Error("FORBIDDEN");
    return { id: userId, email: "admin@investmap.local", fullName: "Test", role };
  },
  getCurrentUser: async () => (signedIn ? { id: userId, email: "admin@investmap.local", fullName: "Test", role } : null),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.55" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, updateTag: () => undefined }));

const actions = await import("./invest-actions");
const { GET: exportCsv } = await import("@/app/api/invest/export/route");

const tag = `IT${Date.now()}`;
const startedAt = new Date();
let regionId = "";
const L = (uz: string, ru = "") => ({ uz, oz: "", ru, en: "" });

const objectInput = (over: Record<string, unknown> = {}) => ({
  regionId,
  name: L(`${tag} object`, "Объект"),
  description: L(""),
  category: "industry",
  status: "AVAILABLE",
  areaHa: 12.5,
  priceUsd: 50000,
  lng: 60.5,
  lat: 40.5,
  publish: "DRAFT",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  ...over,
});

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: "admin@investmap.local" } })).id;
  const region = await db.region.create({
    data: {
      slug: `${tag.toLowerCase()}-region`,
      status: "PUBLISHED",
      name: { uz: `${tag} Hudud`, ru: `${tag} Район`, oz: "", en: "" },
      description: {},
      geometry: { type: "Polygon", coordinates: [[[60, 40], [61, 40], [61, 41], [60, 41], [60, 40]]] },
      centerLng: 60.5,
      centerLat: 40.5,
    },
  });
  regionId = region.id;
});
beforeEach(() => {
  role = "SUPER_ADMIN";
  signedIn = true;
  denied.clear();
});
afterAll(async () => {
  await db.region.deleteMany({ where: { slug: { startsWith: tag.toLowerCase() } } }); // cascades to objects and auctions
  await db.mediaAsset.deleteMany({ where: { key: { startsWith: `it/${tag}` } } });
  await db.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, ip: "203.0.113.55" } });
  await db.$disconnect();
});

describe("saveObject / deleteObject", () => {
  it("creates, updates and deletes with audit entries", async () => {
    const created = await actions.saveObject("en", null, objectInput({ contactEmail: "a@b.uz", contactPhone: "+998 90 000 00 00" }));
    if (!created.ok) throw new Error(created.error);
    const row = await db.investObject.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.slug).toMatch(/^object-[0-9a-f]{8}$/);
    expect(row).toMatchObject({ areaHa: 12.5, priceUsd: 50000, contactEmail: "a@b.uz", contactName: null, publish: "DRAFT" });
    expect(await db.auditLog.count({ where: { entityId: created.id, action: "invest.create", userId } })).toBe(1);

    expect(await actions.saveObject("en", created.id, objectInput({ areaHa: 99, priceUsd: null, status: "AUCTION" }))).toEqual({ ok: true, id: created.id });
    expect(await db.investObject.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ areaHa: 99, priceUsd: null, status: "AUCTION" });

    expect(await actions.deleteObject("en", created.id)).toEqual({ ok: true, id: created.id });
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: created.id, action: "invest.delete" } });
    expect((log.before as { areaHa: number }).areaHa).toBe(99);
    expect(await actions.deleteObject("en", created.id)).toEqual({ ok: false, error: "notFound" });
  });

  it("rejects invalid input and unknown regions without writing", async () => {
    const before = await db.investObject.count();
    expect(await actions.saveObject("en", null, objectInput({ areaHa: 0 }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveObject("en", null, objectInput({ category: "spaceships" }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveObject("en", null, objectInput({ lng: 999 }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveObject("en", null, objectInput({ contactEmail: "bad" }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveObject("en", null, objectInput({ publish: "PUBLISHED", name: L("") }))).toEqual({ ok: false, error: "nameRequired" });
    expect(await actions.saveObject("en", null, objectInput({ regionId: "nope" }))).toEqual({ ok: false, error: "unknown_region" });
    expect(await actions.saveObject("en", "missing", objectInput())).toEqual({ ok: false, error: "notFound" });
    expect(await db.investObject.count()).toBe(before);
  });

  it("attaches and replaces documents, rejecting unknown files", async () => {
    const d1 = await db.mediaAsset.create({ data: { key: `it/${tag}-1`, filename: "a.pdf", mimeType: "application/pdf", size: 1 } });
    const d2 = await db.mediaAsset.create({ data: { key: `it/${tag}-2`, filename: "b.pdf", mimeType: "application/pdf", size: 1 } });
    const created = await actions.saveObject("en", null, objectInput({ name: L(`${tag} with docs`) }), [d1.id]);
    if (!created.ok) throw new Error(created.error);
    const docs = async () => (await db.investObject.findUniqueOrThrow({ where: { id: created.id }, include: { documents: true } })).documents.map((d) => d.id).sort();
    expect(await docs()).toEqual([d1.id]);
    await actions.saveObject("en", created.id, objectInput({ name: L(`${tag} with docs`) }), [d2.id]);
    expect(await docs()).toEqual([d2.id]);
    expect(await actions.saveObject("en", created.id, objectInput(), ["no-such-file"])).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveObject("en", created.id, objectInput(), "not-an-array")).toEqual({ ok: false, error: "invalid" });
    expect(await docs()).toEqual([d2.id]);
  });

  it("enforces roles on the server", async () => {
    role = "INVESTOR";
    await expect(actions.saveObject("en", null, objectInput())).rejects.toThrow("FORBIDDEN");
    role = "CONTENT_EDITOR";
    await expect(actions.deleteObject("en", "x")).rejects.toThrow("FORBIDDEN");
    role = "MAP_EDITOR"; // may view and update objects, but not create or delete
    await expect(actions.saveObject("en", null, objectInput())).rejects.toThrow("FORBIDDEN");
    await expect(actions.deleteObject("en", "x")).rejects.toThrow("FORBIDDEN");
    role = "ADMIN";
    expect((await actions.saveObject("en", null, objectInput({ name: L(`${tag} by admin`) }))).ok).toBe(true);
  });
});

describe("CSV import", () => {
  const csv = (...lines: string[]) => ["name,region,category,area,price,lng,lat,slug", ...lines].join("\n");

  it("preview writes nothing and reports problems", async () => {
    const before = await db.investObject.count();
    const text = csv(`${tag} A,${tag} Hudud,industry,1,100,60.5,40.5,`, `${tag} B,Nowhere,industry,1,,60.5,40.5,`);
    const res = await actions.previewObjectsCsv("en", text);
    expect(res).toMatchObject({ ok: true, valid: 1, willUpdate: 0 });
    if (res.ok) expect(res.errors).toEqual([{ row: 3, field: "region", code: "unknown_region" }]);
    expect(await db.investObject.count()).toBe(before);
  });

  it("imports valid rows, skips invalid ones, and then updates by slug without wiping other fields", async () => {
    const slug = `${tag.toLowerCase()}-plot`;
    const first = await actions.importObjectsCsv(
      "en",
      `name_uz,name_ru,region,category,area,price,lng,lat,slug,status,publish\n${tag} Plot,Участок,${tag} Район,tourism,3,7000,60.4,40.6,${slug},auction,published\nbroken,Nowhere,x,industry,1,,0,0,,,`,
    );
    expect(first).toEqual({ ok: true, created: 1, updated: 0, skipped: 1, downgraded: 0 });
    const created = await db.investObject.findUniqueOrThrow({ where: { slug } });
    expect(created).toMatchObject({ category: "tourism", status: "AUCTION", publish: "PUBLISHED", areaHa: 3, priceUsd: 7000 });
    expect(created.name).toMatchObject({ uz: `${tag} Plot`, ru: "Участок" });

    // A sheet with only some columns must leave status, publish, price and other languages alone.
    const second = await actions.importObjectsCsv("en", `slug,name,region,category,area,lng,lat\n${slug},${tag} Plot v2,${tag} Hudud,tourism,4,60.4,40.6`);
    expect(second).toEqual({ ok: true, created: 0, updated: 1, skipped: 0, downgraded: 0 });
    const updated = await db.investObject.findUniqueOrThrow({ where: { slug } });
    expect(updated).toMatchObject({ areaHa: 4, status: "AUCTION", publish: "PUBLISHED", priceUsd: 7000 });
    expect(updated.name).toMatchObject({ uz: `${tag} Plot v2`, ru: "Участок" });

    expect(await db.auditLog.count({ where: { action: "invest.import", ip: "203.0.113.55" } })).toBe(2);
  });

  it("needs the update right as well when a row matches an existing object", async () => {
    const slug = `${tag.toLowerCase()}-guarded`;
    const sheet = `slug,name,region,category,area,lng,lat\n${slug},${tag} Guarded,${tag} Hudud,industry,1,60.4,40.6`;
    expect(await actions.importObjectsCsv("en", sheet)).toMatchObject({ ok: true, created: 1 });

    denied.add("invest:update"); // a role that may create but not update
    const edited = sheet.replace(",1,60.4", ",999,60.4");
    await expect(actions.importObjectsCsv("en", edited)).rejects.toThrow("FORBIDDEN");
    expect((await db.investObject.findUniqueOrThrow({ where: { slug } })).areaHa).toBe(1);

    // New rows alone are still fine for that role.
    const fresh = `slug,name,region,category,area,lng,lat\n${slug}-new,${tag} New,${tag} Hudud,industry,2,60.4,40.6`;
    expect(await actions.importObjectsCsv("en", fresh)).toMatchObject({ ok: true, created: 1, updated: 0 });
  });

  it("reports unusable files", async () => {
    expect(await actions.importObjectsCsv("en", "")).toEqual({ ok: false, error: "csv_empty" });
    expect(await actions.importObjectsCsv("en", 'a,b\n"open')).toEqual({ ok: false, error: "csv_unterminated_quote" });
    expect(await actions.importObjectsCsv("en", "name,region\nA,B")).toMatchObject({ ok: false, error: "csv_missing_columns", missing: ["category", "area_ha", "lng", "lat"] });
    expect(await actions.importObjectsCsv("en", csv(`x,Nowhere,industry,1,,0,0,`))).toEqual({ ok: false, error: "csv_nothing" });
    role = "INVESTOR";
    await expect(actions.importObjectsCsv("en", csv())).rejects.toThrow("FORBIDDEN");
  });

  it("exports a CSV the importer can read back, and protects the download", async () => {
    await actions.saveObject("en", null, objectInput({ name: L(`=${tag} formula, "quoted"`) }));
    const res = await exportCsv();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    const parsed = parseCsv(text);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.rows[0].slice(0, 3)).toEqual(["slug", "region", "name_uz"]);
    const row = parsed.rows.find((r) => r[2].includes(`${tag} formula`));
    expect(row?.[2]).toBe(`'=${tag} formula, "quoted"`); // formula neutralised, quotes survive

    signedIn = false;
    expect((await exportCsv()).status).toBe(401);
    signedIn = true;
    role = "INVESTOR";
    expect((await exportCsv()).status).toBe(403);
  });
});

describe("deleting a region", () => {
  it("is refused while the region still has objects, then allowed", async () => {
    const { deleteRegion } = await import("./map-actions");
    const region = await db.region.create({
      data: {
        slug: `${tag.toLowerCase()}-empty-check`,
        status: "DRAFT",
        name: L(`${tag} to delete`),
        description: {},
        geometry: { type: "Polygon", coordinates: [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]] },
        centerLng: 10.5,
        centerLat: 10.5,
      },
    });
    const obj = await actions.saveObject("en", null, objectInput({ regionId: region.id, name: L(`${tag} inside`) }));
    if (!obj.ok) throw new Error(obj.error);

    expect(await deleteRegion("en", region.id)).toEqual({ ok: false, error: "regionHasObjects" });
    expect(await db.region.findUnique({ where: { id: region.id } })).not.toBeNull();
    expect(await db.investObject.findUnique({ where: { id: obj.id } })).not.toBeNull();

    await actions.deleteObject("en", obj.id);
    expect(await deleteRegion("en", region.id)).toEqual({ ok: true, id: region.id });
  });
});

describe("auctions", () => {
  const auction = (objectId: string, over: Record<string, unknown> = {}) => ({
    objectId,
    status: "SCHEDULED",
    publish: "DRAFT",
    startsAt: "2027-03-01T09:00:00Z",
    endsAt: "2027-03-02T09:00:00Z",
    startPriceUsd: 10000,
    terms: L("Shartlar"),
    finalPriceUsd: null,
    resultNote: L(""),
    ...over,
  });

  async function newObject() {
    const r = await actions.saveObject("en", null, objectInput({ name: L(`${tag} lot object`) }));
    if (!r.ok) throw new Error(r.error);
    return r.id;
  }

  it("creates, updates with a result, and deletes a lot", async () => {
    const objectId = await newObject();
    const created = await actions.saveAuction("en", null, auction(objectId));
    if (!created.ok) throw new Error(created.error);
    expect(await db.auction.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: "SCHEDULED", startPriceUsd: 10000, finalPriceUsd: null });
    expect(await db.auditLog.count({ where: { entityId: created.id, action: "auction.create" } })).toBe(1);

    const closed = await actions.saveAuction("en", created.id, auction(objectId, { status: "CLOSED", finalPriceUsd: 12500, resultNote: L("Sotildi"), publish: "PUBLISHED" }));
    expect(closed).toEqual({ ok: true, id: created.id });
    const row = await db.auction.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({ status: "CLOSED", finalPriceUsd: 12500, publish: "PUBLISHED" });
    expect(row.startsAt.toISOString()).toBe("2027-03-01T09:00:00.000Z");

    expect(await actions.deleteAuction("en", created.id)).toEqual({ ok: true, id: created.id });
    expect(await actions.deleteAuction("en", created.id)).toEqual({ ok: false, error: "notFound" });
  });

  it("validates dates, results and the linked object", async () => {
    const objectId = await newObject();
    expect(await actions.saveAuction("en", null, auction(objectId, { endsAt: "2027-03-01T09:00:00Z" }))).toEqual({ ok: false, error: "ends_before_start" });
    expect(await actions.saveAuction("en", null, auction(objectId, { finalPriceUsd: 1 }))).toEqual({ ok: false, error: "result_needs_closed" });
    expect(await actions.saveAuction("en", null, auction(objectId, { startsAt: "garbage" }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveAuction("en", null, auction(objectId, { startPriceUsd: -5 }))).toEqual({ ok: false, error: "invalid" });
    expect(await actions.saveAuction("en", null, auction("missing-object"))).toEqual({ ok: false, error: "unknown_object" });
    expect(await actions.saveAuction("en", "missing", auction(objectId))).toEqual({ ok: false, error: "notFound" });
    expect(await db.auction.count({ where: { objectId } })).toBe(0);
  });

  it("removes lots together with their object and enforces roles", async () => {
    const objectId = await newObject();
    const a = await actions.saveAuction("en", null, auction(objectId));
    if (!a.ok) throw new Error(a.error);
    await actions.deleteObject("en", objectId);
    expect(await db.auction.findUnique({ where: { id: a.id } })).toBeNull();

    role = "CONTENT_EDITOR";
    await expect(actions.saveAuction("en", null, auction("x"))).rejects.toThrow("FORBIDDEN");
    role = "MAP_EDITOR"; // may view and update lots, but not create or delete
    await expect(actions.saveAuction("en", null, auction("x"))).rejects.toThrow("FORBIDDEN");
    await expect(actions.deleteAuction("en", "x")).rejects.toThrow("FORBIDDEN");
  });
});
