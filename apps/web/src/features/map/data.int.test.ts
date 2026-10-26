import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadMapData } from "./data";

const tag = `it-map-${Date.now()}`;
const square = { type: "Polygon", coordinates: [[[60, 40], [61, 40], [61, 41], [60, 41], [60, 40]]] };
const names = { uz: "Test", ru: "Тест" };

afterAll(async () => {
  await db.region.deleteMany({ where: { slug: { startsWith: tag } } });
  await db.$disconnect();
});

const region = (suffix: string, over: Record<string, unknown> = {}) =>
  db.region.create({
    data: { slug: `${tag}-${suffix}`, status: "PUBLISHED", name: names, description: {}, geometry: square, centerLng: 60.5, centerLat: 40.5, ...over } as never,
  });

const object = (regionId: string, suffix: string, over: Record<string, unknown> = {}) =>
  db.investObject.create({
    data: { slug: `${tag}-o-${suffix}`, regionId, publish: "PUBLISHED", name: names, description: {}, category: "industry", areaHa: 1, lng: 60.5, lat: 40.5, ...over } as never,
  });

describe("loadMapData", () => {
  it("returns published regions and their published objects only", async () => {
    const good = await region("good");
    const draft = await region("draft", { status: "DRAFT" });
    await object(good.id, "ok");
    await object(good.id, "draft", { publish: "DRAFT" });
    await object(draft.id, "in-draft-region");

    const { regions, objects } = await loadMapData();
    const slugs = regions.map((r) => r.slug);
    expect(slugs).toContain(`${tag}-good`);
    expect(slugs).not.toContain(`${tag}-draft`);

    const mine = objects.filter((o) => o.slug.startsWith(`${tag}-o-`)).map((o) => o.slug);
    expect(mine).toEqual([`${tag}-o-ok`]);
  });

  it("skips regions with broken geometry and objects with unknown categories instead of throwing", async () => {
    const broken = await region("broken", { geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1]]] } });
    const fine = await region("fine");
    await object(broken.id, "orphan");
    await object(fine.id, "weird-category", { category: "spaceships" });
    await object(fine.id, "valid", { category: "tourism", status: "AUCTION", priceUsd: 123.5 });

    const { regions, objects } = await loadMapData();
    expect(regions.map((r) => r.slug)).not.toContain(`${tag}-broken`);
    const mine = objects.filter((o) => o.slug.startsWith(`${tag}-o-`));
    expect(mine.map((o) => o.slug)).toContain(`${tag}-o-valid`);
    expect(mine.map((o) => o.slug)).not.toContain(`${tag}-o-orphan`);
    expect(mine.map((o) => o.slug)).not.toContain(`${tag}-o-weird-category`);

    const valid = mine.find((o) => o.slug === `${tag}-o-valid`)!;
    expect(valid).toMatchObject({ category: "tourism", status: "AUCTION", priceUsd: 123.5, lng: 60.5, lat: 40.5 });
  });

  it("deleting a region removes its objects", async () => {
    const r = await region("cascade");
    const o = await object(r.id, "cascade");
    await db.region.delete({ where: { id: r.id } });
    expect(await db.investObject.findUnique({ where: { id: o.id } })).toBeNull();
  });
});
