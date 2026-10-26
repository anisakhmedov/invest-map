import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { deleteObject } from "@/lib/s3";

let role = "SUPER_ADMIN";
let userId = "";

vi.mock("@/lib/auth", () => ({
  requirePermission: async (_lang: string, resource: never, action: never) => {
    if (!can(role, resource, action)) throw new Error("FORBIDDEN");
    return { id: userId, email: "admin@investmap.local", fullName: "Test", role };
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, updateTag: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { deleteMedia, deletePage, saveContacts, savePage, uploadMedia } = await import("./cms-actions");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHrW7DAAAAABJRU5ErkJggg==",
  "base64",
);

const startedAt = new Date();
const slugs: string[] = [];
const slug = (label: string) => {
  const s = `it-${label}-${Date.now()}`;
  slugs.push(s);
  return s;
};

function form(entries: Record<string, string | Blob>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

const pageForm = (over: Record<string, string> = {}) =>
  form({
    kind: "NEWS",
    slug: slug("p"),
    status: "PUBLISHED",
    title_uz: "Sarlavha",
    title_oz: "",
    title_ru: "Заголовок",
    title_en: "",
    body_uz: "Matn",
    body_oz: "",
    body_ru: "",
    body_en: "",
    ...over,
  });

async function redirectTarget(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return m[1];
    throw e;
  }
  return null;
}

beforeAll(async () => {
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@investmap.local" } });
  userId = admin.id;
});

beforeEach(() => {
  role = "SUPER_ADMIN";
});

afterAll(async () => {
  const assets = await db.mediaAsset.findMany({ where: { createdAt: { gte: startedAt } } });
  for (const a of assets) await deleteObject(a.key).catch(() => undefined);
  await db.mediaAsset.deleteMany({ where: { createdAt: { gte: startedAt } } });
  await db.page.deleteMany({ where: { slug: { in: slugs } } });
  await db.siteSetting.deleteMany({ where: { key: "contacts" } });
  await db.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, ip: "203.0.113.9" } });
  await db.$disconnect();
});

describe("savePage", () => {
  it("creates a page, redirects to the list and writes an audit entry", async () => {
    const fd = pageForm();
    const target = await redirectTarget(savePage("en", null, undefined, fd));
    expect(target).toBe("/en/admin/pages");

    const page = await db.page.findFirstOrThrow({ where: { slug: fd.get("slug") as string } });
    expect(page.status).toBe("PUBLISHED");
    expect(page.publishedAt).not.toBeNull();
    expect(page.kind).toBe("NEWS");

    const log = await db.auditLog.findFirst({ where: { entityId: page.id, action: "page.create" } });
    expect(log?.userId).toBe(userId);
    expect(log?.ip).toBe("203.0.113.9");
  });

  it("keeps the original publishedAt on later edits and clears it when unpublished", async () => {
    const fd = pageForm();
    await redirectTarget(savePage("en", null, undefined, fd));
    const page = await db.page.findFirstOrThrow({ where: { slug: fd.get("slug") as string } });

    await redirectTarget(savePage("en", page.id, undefined, pageForm({ slug: page.slug, title_uz: "Yangi" })));
    const edited = await db.page.findUniqueOrThrow({ where: { id: page.id } });
    expect(edited.publishedAt?.getTime()).toBe(page.publishedAt?.getTime());

    await redirectTarget(savePage("en", page.id, undefined, pageForm({ slug: page.slug, status: "DRAFT" })));
    expect((await db.page.findUniqueOrThrow({ where: { id: page.id } })).publishedAt).toBeNull();
  });

  it("rejects duplicate slugs, invalid slugs and untitled published pages", async () => {
    const fd = pageForm();
    await redirectTarget(savePage("en", null, undefined, fd));
    const dup = await savePage("en", null, undefined, pageForm({ slug: fd.get("slug") as string }));
    expect(dup).toEqual({ error: "slugTaken" });

    expect(await savePage("en", null, undefined, pageForm({ slug: "Bad Slug!" }))).toEqual({ error: "slugInvalid" });
    expect(await savePage("en", null, undefined, pageForm({ title_uz: "" }))).toEqual({ error: "titleRequired" });
  });

  it("returns notFound when editing a missing page", async () => {
    expect(await savePage("en", "missing-id", undefined, pageForm())).toEqual({ error: "notFound" });
  });

  it("enforces permissions on the server", async () => {
    role = "INVESTOR";
    await expect(savePage("en", null, undefined, pageForm())).rejects.toThrow("FORBIDDEN");
    role = "MAP_EDITOR";
    await expect(savePage("en", null, undefined, pageForm())).rejects.toThrow("FORBIDDEN");
    role = "CONTENT_EDITOR";
    const target = await redirectTarget(savePage("en", null, undefined, pageForm()));
    expect(target).toBe("/en/admin/pages");
  });

  it("deletes with an audit entry that keeps the old values", async () => {
    const fd = pageForm();
    await redirectTarget(savePage("en", null, undefined, fd));
    const page = await db.page.findFirstOrThrow({ where: { slug: fd.get("slug") as string } });
    await redirectTarget(deletePage("en", page.id));
    expect(await db.page.findUnique({ where: { id: page.id } })).toBeNull();
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: page.id, action: "page.delete" } });
    expect((log.before as { slug: string }).slug).toBe(page.slug);

    role = "CONTENT_EDITOR";
    await redirectTarget(savePage("en", null, undefined, pageForm()));
    role = "REQUEST_MANAGER";
    await expect(deletePage("en", page.id)).rejects.toThrow("FORBIDDEN");
  });
});

describe("uploadMedia", () => {
  it("stores a valid image, records it and audits it", async () => {
    const file = new File([PNG], "../../my photo.png", { type: "application/octet-stream" });
    const res = await uploadMedia("en", undefined, form({ file, alt_uz: "Rasm", alt_ru: "", alt_oz: "", alt_en: "" }));
    expect(res).toEqual({ saved: true });

    const asset = await db.mediaAsset.findFirstOrThrow({ where: { createdAt: { gte: startedAt } }, orderBy: { createdAt: "desc" } });
    expect(asset.mimeType).toBe("image/png"); // detected from bytes, not from the declared type
    expect(asset.filename).toBe("my photo.png");
    expect(asset.key).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(asset.uploadedBy).toBe(userId);
    expect(await db.auditLog.count({ where: { entityId: asset.id, action: "media.create" } })).toBe(1);

    await deleteMedia("en", asset.id);
    expect(await db.mediaAsset.findUnique({ where: { id: asset.id } })).toBeNull();
    expect(await db.auditLog.count({ where: { entityId: asset.id, action: "media.delete" } })).toBe(1);
  });

  it("rejects disguised, empty and oversize files without creating records", async () => {
    const before = await db.mediaAsset.count();
    const fake = new File(["<svg><script>alert(1)</script></svg>"], "evil.png", { type: "image/png" });
    expect(await uploadMedia("en", undefined, form({ file: fake }))).toEqual({ error: "unsupported_type" });
    expect(await uploadMedia("en", undefined, form({ file: new File([], "empty.png") }))).toEqual({ error: "empty" });
    expect(await uploadMedia("en", undefined, form({}))).toEqual({ error: "empty" });

    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    expect(await uploadMedia("en", undefined, form({ file: new File([big], "big.png") }))).toEqual({ error: "too_large" });
    expect(await db.mediaAsset.count()).toBe(before);
  });

  it("requires media permission", async () => {
    role = "REQUEST_MANAGER";
    await expect(uploadMedia("en", undefined, form({ file: new File([PNG], "a.png") }))).rejects.toThrow("FORBIDDEN");
  });
});

describe("saveContacts", () => {
  const contacts = (over: Record<string, string> = {}) =>
    form({ email: "info@investmap.uz", phone: "+998 71 000 00 00", address_uz: "Toshkent", address_oz: "", address_ru: "Ташкент", address_en: "", ...over });

  it("saves valid contacts and audits the change", async () => {
    expect(await saveContacts("en", undefined, contacts())).toEqual({ saved: true });
    const row = await db.siteSetting.findUniqueOrThrow({ where: { key: "contacts" } });
    expect((row.value as { email: string }).email).toBe("info@investmap.uz");
    expect(await db.auditLog.count({ where: { entityId: "contacts", action: "settings.update", createdAt: { gte: startedAt } } })).toBeGreaterThan(0);
  });

  it("rejects an invalid email and non-editors", async () => {
    expect(await saveContacts("en", undefined, contacts({ email: "nope" }))).toEqual({ error: "invalid" });
    role = "CONTENT_EDITOR";
    await expect(saveContacts("en", undefined, contacts())).rejects.toThrow("FORBIDDEN");
  });
});
