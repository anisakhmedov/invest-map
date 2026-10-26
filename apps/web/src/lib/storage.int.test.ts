import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { buildObjectKey, checkUpload } from "./media";
import { deleteObject, getObject, putObject, readObjectBytes } from "./s3";
import { GET } from "@/app/api/media/[id]/route";
import { Prisma } from "@prisma/client";

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHrW7DAAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const created: { assetIds: string[]; keys: string[]; slugs: string[] } = { assetIds: [], keys: [], slugs: [] };

afterAll(async () => {
  await db.mediaAsset.deleteMany({ where: { id: { in: created.assetIds } } });
  await db.page.deleteMany({ where: { slug: { in: created.slugs } } });
  for (const k of created.keys) await deleteObject(k).catch(() => undefined);
  await db.$disconnect();
});

describe("object storage", () => {
  it("round-trips bytes through S3", async () => {
    const key = buildObjectKey("image/png");
    created.keys.push(key);
    await putObject(key, PNG, "image/png");
    const got = await readObjectBytes(key);
    expect(Buffer.from(got).equals(Buffer.from(PNG))).toBe(true);
    await deleteObject(key);
    await expect(getObject(key)).rejects.toThrow();
  });

  it("serves a registered asset publicly with safe headers, 404 for unknown ids", async () => {
    expect(checkUpload(PNG)).toEqual({ ok: true, mime: "image/png" });
    const key = buildObjectKey("image/png");
    created.keys.push(key);
    await putObject(key, PNG, "image/png");
    const asset = await db.mediaAsset.create({
      data: { key, filename: "pixel.png", mimeType: "image/png", size: PNG.length },
    });
    created.assetIds.push(asset.id);

    const ok = await GET(new Request("http://x"), { params: Promise.resolve({ id: asset.id }) } as never);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("content-security-policy")).toContain("sandbox");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);

    const missing = await GET(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) } as never);
    expect(missing.status).toBe(404);
  });

  it("refuses to serve an asset whose stored type is not allowed", async () => {
    const key = buildObjectKey("image/png");
    created.keys.push(key);
    await putObject(key, new TextEncoder().encode("<svg/>"), "image/svg+xml");
    const asset = await db.mediaAsset.create({
      data: { key, filename: "x.svg", mimeType: "image/svg+xml", size: 6 },
    });
    created.assetIds.push(asset.id);
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: asset.id }) } as never);
    expect(res.status).toBe(404);
  });
});

describe("pages table", () => {
  it("enforces unique slug per kind but allows the same slug for another kind", async () => {
    const slug = `int-test-${Date.now()}`;
    created.slugs.push(slug);
    const data = { slug, title: { uz: "t" }, body: { uz: "b" } };
    await db.page.create({ data: { ...data, kind: "PAGE" } });
    await db.page.create({ data: { ...data, kind: "NEWS" } });
    await expect(db.page.create({ data: { ...data, kind: "PAGE" } })).rejects.toMatchObject({
      code: "P2002",
    } satisfies Partial<Prisma.PrismaClientKnownRequestError>);
  });

  it("keeps the page when its cover asset is deleted", async () => {
    const key = buildObjectKey("image/png");
    const asset = await db.mediaAsset.create({ data: { key, filename: "c.png", mimeType: "image/png", size: 1 } });
    const slug = `int-cover-${Date.now()}`;
    created.slugs.push(slug);
    const page = await db.page.create({
      data: { slug, kind: "PAGE", title: { uz: "t" }, body: { uz: "b" }, coverId: asset.id },
    });
    await db.mediaAsset.delete({ where: { id: asset.id } });
    const after = await db.page.findUniqueOrThrow({ where: { id: page.id } });
    expect(after.coverId).toBeNull();
  });
});
