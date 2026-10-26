"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { requestIp as ip } from "@/lib/request-ip";
import { buildAuditEntry } from "@/lib/audit";
import { contactsSchema, pageInputSchema } from "@/lib/content";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES, buildObjectKey, checkUpload, sanitizeFilename } from "@/lib/media";
import { can } from "@/lib/rbac";
import { deleteObject, putObject } from "@/lib/s3";
import { defaultLocale, hasLocale } from "@/i18n/config";

export type FormState = { error?: string; saved?: boolean } | undefined;

const loc = (lang: string) => (hasLocale(lang) ? lang : defaultLocale);

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function localizedFields(formData: FormData, prefix: string) {
  return {
    uz: field(formData, `${prefix}_uz`),
    oz: field(formData, `${prefix}_oz`),
    ru: field(formData, `${prefix}_ru`),
    en: field(formData, `${prefix}_en`),
  };
}

export async function savePage(
  lang: string,
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePermission(lang, "page", id ? "update" : "create");

  const parsed = pageInputSchema.safeParse({
    kind: field(formData, "kind"),
    slug: field(formData, "slug"),
    status: field(formData, "status"),
    title: localizedFields(formData, "title"),
    body: localizedFields(formData, "body"),
  });
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0];
    return { error: path === "slug" ? "slugInvalid" : path === "title" ? "titleRequired" : "invalid" };
  }
  const input = parsed.data;
  if (input.status === "PUBLISHED" && !can(user.role, "page", "publish")) return { error: "cannotPublish" };

  const before = id ? await db.page.findUnique({ where: { id } }) : null;
  if (id && !before) return { error: "notFound" };

  try {
    const data = {
      kind: input.kind,
      slug: input.slug,
      status: input.status,
      title: input.title,
      body: input.body,
      publishedAt:
        input.status === "PUBLISHED" ? (before?.publishedAt ?? new Date()) : null,
    };
    const saved = id
      ? await db.page.update({ where: { id }, data })
      : await db.page.create({ data });
    await db.auditLog.create({
      data: buildAuditEntry({
        userId: user.id,
        action: id ? "page.update" : "page.create",
        entity: "Page",
        entityId: saved.id,
        before,
        after: saved,
        ip: await ip(),
      }),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "slugTaken" };
    throw e;
  }

  revalidatePath("/", "layout");
  redirect(`/${loc(lang)}/admin/pages`);
}

export async function deletePage(lang: string, id: string) {
  const user = await requirePermission(lang, "page", "delete");
  const before = await db.page.findUnique({ where: { id } });
  if (!before) return;
  await db.page.delete({ where: { id } });
  await db.auditLog.create({
    data: buildAuditEntry({ userId: user.id, action: "page.delete", entity: "Page", entityId: id, before, ip: await ip() }),
  });
  revalidatePath("/", "layout");
  redirect(`/${loc(lang)}/admin/pages`);
}

export async function uploadMedia(lang: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(lang, "media", "create");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "empty" };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "too_large" }; // before buffering it in memory

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes);
  if (!check.ok) return { error: check.reason };

  const key = buildObjectKey(check.mime);
  try {
    await putObject(key, bytes, check.mime);
  } catch {
    return { error: "storageUnavailable" };
  }

  const asset = await db.mediaAsset.create({
    data: {
      key,
      filename: sanitizeFilename(file.name),
      mimeType: check.mime,
      size: bytes.length,
      alt: Object.fromEntries(Object.entries(localizedFields(formData, "alt")).map(([k, v]) => [k, v.trim().slice(0, 200)])),
      uploadedBy: user.id,
    },
  });
  await db.auditLog.create({
    data: buildAuditEntry({ userId: user.id, action: "media.create", entity: "MediaAsset", entityId: asset.id, after: asset, ip: await ip() }),
  });
  revalidatePath(`/${loc(lang)}/admin/media`);
  return { saved: true };
}

export async function deleteMedia(lang: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requirePermission(lang, "media", "delete");
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return { ok: false, error: "notFound" };
  // A plan overlay needs its image; the database refuses the delete, so say why instead of crashing.
  if ((await db.planOverlay.count({ where: { mediaId: id } })) > 0) return { ok: false, error: "mediaInUsePlan" };
  await db.mediaAsset.delete({ where: { id } });
  await deleteObject(asset.key).catch(() => undefined);
  await db.auditLog.create({
    data: buildAuditEntry({ userId: user.id, action: "media.delete", entity: "MediaAsset", entityId: id, before: asset, ip: await ip() }),
  });
  revalidatePath(`/${loc(lang)}/admin/media`);
  return { ok: true };
}

export async function saveContacts(lang: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(lang, "settings", "update");
  const parsed = contactsSchema.safeParse({
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    address: localizedFields(formData, "address"),
  });
  if (!parsed.success) return { error: "invalid" };

  const before = await db.siteSetting.findUnique({ where: { key: "contacts" } });
  const saved = await db.siteSetting.upsert({
    where: { key: "contacts" },
    update: { value: parsed.data },
    create: { key: "contacts", value: parsed.data },
  });
  await db.auditLog.create({
    data: buildAuditEntry({ userId: user.id, action: "settings.update", entity: "SiteSetting", entityId: "contacts", before: before?.value, after: saved.value, ip: await ip() }),
  });
  updateTag("site-settings");
  revalidatePath("/", "layout");
  return { saved: true };
}
