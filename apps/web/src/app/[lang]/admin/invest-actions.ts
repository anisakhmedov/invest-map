"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { requestIp as ip } from "@/lib/request-ip";
import { buildAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { parseCsv } from "@/features/invest/csv";
import { analyzeObjectCsv, mergeLocalized, type ImportAnalysis, type ImportRowError } from "@/features/invest/import-objects";
import { auctionInputSchema, objectInputSchema } from "@/features/invest/schemas";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const loc = (lang: string) => (hasLocale(lang) ? lang : defaultLocale);
const newSlug = () => `object-${randomBytes(4).toString("hex")}`;
const documentIdsSchema = z.array(z.string().min(1).max(40)).max(20);

function refresh(lang: string) {
  updateTag("public-data");
  for (const path of ["map", "projects", "auction", "admin/invest", "admin/auction"]) revalidatePath(`/${loc(lang)}/${path}`);
}

async function audit(userId: string, action: string, entity: string, entityId: string | null, before: unknown, after: unknown) {
  await db.auditLog.create({ data: buildAuditEntry({ userId, action, entity, entityId, before, after, ip: await ip() }) });
}

// ---------- objects ----------

export async function saveObject(lang: string, id: string | null, input: unknown, documentIds: unknown = []): Promise<ActionResult> {
  const user = await requirePermission(lang, "invest", id ? "update" : "create");
  const parsed = objectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message === "name_required" ? "nameRequired" : "invalid" };
  const docs = documentIdsSchema.safeParse(documentIds);
  if (!docs.success) return { ok: false, error: "invalid" };
  const o = parsed.data;
  if (o.publish === "PUBLISHED" && !can(user.role, "invest", "publish")) return { ok: false, error: "cannotPublish" };

  const [region, before, files] = await Promise.all([
    db.region.findUnique({ where: { id: o.regionId }, select: { id: true } }),
    id ? db.investObject.findUnique({ where: { id }, include: { documents: { select: { id: true } } } }) : null,
    db.mediaAsset.findMany({ where: { id: { in: docs.data } }, select: { id: true } }),
  ]);
  if (!region) return { ok: false, error: "unknown_region" };
  if (id && !before) return { ok: false, error: "notFound" };
  if (files.length !== new Set(docs.data).size) return { ok: false, error: "invalid" };

  const data = {
    regionId: o.regionId,
    name: o.name,
    description: o.description,
    category: o.category,
    status: o.status,
    areaHa: o.areaHa,
    priceUsd: o.priceUsd,
    lng: o.lng,
    lat: o.lat,
    publish: o.publish,
    contactName: o.contactName || null,
    contactPhone: o.contactPhone || null,
    contactEmail: o.contactEmail || null,
  };
  const links = files.map((f) => ({ id: f.id }));
  const saved = id
    ? await db.investObject.update({ where: { id }, data: { ...data, documents: { set: links } } })
    : await db.investObject.create({ data: { ...data, slug: newSlug(), documents: { connect: links } } });
  await audit(user.id, id ? "invest.update" : "invest.create", "InvestObject", saved.id, before, saved);
  refresh(lang);
  return { ok: true, id: saved.id };
}

export async function deleteObject(lang: string, id: string): Promise<ActionResult> {
  const user = await requirePermission(lang, "invest", "delete");
  const before = await db.investObject.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  await db.investObject.delete({ where: { id } });
  await audit(user.id, "invest.delete", "InvestObject", id, before, null);
  refresh(lang);
  return { ok: true, id };
}

// ---------- CSV import ----------

export type CsvPreview =
  | {
      ok: true;
      valid: number;
      errors: ImportRowError[];
      ignoredColumns: string[];
      willUpdate: number;
    }
  | { ok: false; error: string; missing?: string[] };

type CsvAnalysis = { ok: true; analysis: ImportAnalysis } | { ok: false; error: string; missing?: string[] };

async function analyzeCsv(text: unknown): Promise<CsvAnalysis> {
  if (typeof text !== "string") return { ok: false, error: "invalid" };
  const parsed = parseCsv(text);
  if ("error" in parsed) return { ok: false, error: `csv_${parsed.error}` };
  const regions = (await db.region.findMany({ select: { id: true, slug: true, name: true } })).map((r) => ({
    id: r.id,
    slug: r.slug,
    names: Object.values((r.name ?? {}) as Record<string, string>).filter((v): v is string => typeof v === "string" && v !== ""),
  }));
  const analysis = analyzeObjectCsv(parsed.rows, regions);
  if ("fatal" in analysis) return { ok: false, error: "csv_missing_columns", missing: analysis.missing };
  return { ok: true, analysis };
}

/** Dry run: tells the user what an import would do without writing anything. */
export async function previewObjectsCsv(lang: string, text: string): Promise<CsvPreview> {
  await requirePermission(lang, "invest", "create");
  const r = await analyzeCsv(text);
  if (!r.ok) return { ok: false, error: r.error, missing: r.missing };
  const slugs = r.analysis.objects.map((o) => o.slug).filter((s): s is string => !!s);
  const existing = slugs.length ? await db.investObject.count({ where: { slug: { in: slugs } } }) : 0;
  return {
    ok: true,
    valid: r.analysis.objects.length,
    errors: r.analysis.errors.slice(0, 50),
    ignoredColumns: r.analysis.ignoredColumns,
    willUpdate: existing,
  };
}

export type CsvImportResult =
  | { ok: true; created: number; updated: number; skipped: number; downgraded: number }
  | { ok: false; error: string; missing?: string[] };

/** Imports valid rows and skips invalid ones. A row with an existing slug updates that object. */
export async function importObjectsCsv(lang: string, text: string): Promise<CsvImportResult> {
  const user = await requirePermission(lang, "invest", "create");
  const r = await analyzeCsv(text);
  if (!r.ok) return { ok: false, error: r.error, missing: r.missing };
  const { objects, errors, columns } = r.analysis;
  if (objects.length === 0) return { ok: false, error: "csv_nothing" };

  const has = (c: string) => columns.includes(c);
  const mayPublish = can(user.role, "invest", "publish");
  let downgraded = 0;
  const slugs = objects.map((o) => o.slug).filter((s): s is string => !!s);
  const existingRows = slugs.length
    ? await db.investObject.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true, description: true } })
    : [];
  const existing = new Map(existingRows.map((x) => [x.slug, x]));
  // Rows that match an existing slug update that object, so the update right is needed as well.
  if (existing.size > 0) await requirePermission(lang, "invest", "update");

  await db.$transaction(
    objects.map(({ slug, input: o }) => {
      let publish = o.publish;
      if (publish === "PUBLISHED" && !mayPublish) {
        publish = "DRAFT";
        downgraded++;
      }
      const create = {
        regionId: o.regionId,
        name: o.name,
        description: o.description,
        category: o.category,
        status: o.status,
        areaHa: o.areaHa,
        priceUsd: o.priceUsd,
        lng: o.lng,
        lat: o.lat,
        publish,
        contactName: o.contactName || null,
        contactPhone: o.contactPhone || null,
        contactEmail: o.contactEmail || null,
      };
      const key = slug ?? newSlug();
      const old = slug ? existing.get(slug) : undefined;
      // Updating: only fields whose columns are in the file change, so a partial sheet cannot wipe data.
      const update = {
        regionId: o.regionId,
        category: o.category,
        areaHa: o.areaHa,
        lng: o.lng,
        lat: o.lat,
        name: mergeLocalized(old?.name, o.name, columns, "name"),
        description: mergeLocalized(old?.description, o.description, columns, "description"),
        ...(has("status") && { status: o.status }),
        ...(has("price_usd") && { priceUsd: o.priceUsd }),
        ...(has("publish") && { publish }),
        ...(has("contact_name") && { contactName: create.contactName }),
        ...(has("contact_phone") && { contactPhone: create.contactPhone }),
        ...(has("contact_email") && { contactEmail: create.contactEmail }),
      };
      return db.investObject.upsert({ where: { slug: key }, create: { ...create, slug: key }, update });
    }),
  );

  const updated = objects.filter((o) => o.slug && existing.has(o.slug)).length;
  const result = { created: objects.length - updated, updated, skipped: errors.length, downgraded };
  await audit(user.id, "invest.import", "InvestObject", null, null, result);
  refresh(lang);
  return { ok: true, ...result };
}

// ---------- auctions ----------

export async function saveAuction(lang: string, id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requirePermission(lang, "auction", id ? "update" : "create");
  const parsed = auctionInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { ok: false, error: msg === "ends_before_start" || msg === "result_needs_closed" ? msg : "invalid" };
  }
  const a = parsed.data;
  if (a.publish === "PUBLISHED" && !can(user.role, "auction", "publish")) return { ok: false, error: "cannotPublish" };

  const [object, before] = await Promise.all([
    db.investObject.findUnique({ where: { id: a.objectId }, select: { id: true } }),
    id ? db.auction.findUnique({ where: { id } }) : null,
  ]);
  if (!object) return { ok: false, error: "unknown_object" };
  if (id && !before) return { ok: false, error: "notFound" };

  const saved = id ? await db.auction.update({ where: { id }, data: a }) : await db.auction.create({ data: a });
  await audit(user.id, id ? "auction.update" : "auction.create", "Auction", saved.id, before, saved);
  refresh(lang);
  return { ok: true, id: saved.id };
}

export async function deleteAuction(lang: string, id: string): Promise<ActionResult> {
  const user = await requirePermission(lang, "auction", "delete");
  const before = await db.auction.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  await db.auction.delete({ where: { id } });
  await audit(user.id, "auction.delete", "Auction", id, before, null);
  refresh(lang);
  return { ok: true, id };
}

// Thin wrappers for <form action>, which must return nothing.
export async function removeObject(lang: string, id: string): Promise<void> {
  await deleteObject(lang, id);
}

export async function removeAuction(lang: string, id: string): Promise<void> {
  await deleteAuction(lang, id);
}
