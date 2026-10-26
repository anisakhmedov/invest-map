import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import type { AuctionStatusKey } from "./schemas";

type Localized = Partial<Record<"uz" | "oz" | "ru" | "en", string>>;
const asLocalized = (v: unknown): Localized => (v && typeof v === "object" && !Array.isArray(v) ? (v as Localized) : {});

export type PublicAuction = {
  id: string;
  status: AuctionStatusKey;
  startsAt: Date;
  endsAt: Date;
  startPriceUsd: number;
  finalPriceUsd: number | null;
  terms: Localized;
  resultNote: Localized;
  object: { id: string; name: Localized; regionName: Localized };
};

type PublicAuctions = { current: PublicAuction[]; finished: PublicAuction[] };

/** Cached until an admin changes investment data (`updateTag("public-data")`). */
export async function getPublicAuctions(): Promise<PublicAuctions> {
  "use cache";
  cacheTag("public-data");
  cacheLife("hours");
  return loadPublicAuctions();
}

/** Published lots of published objects in published regions, split into current and finished. */
export async function loadPublicAuctions(): Promise<PublicAuctions> {
  const rows = await db.auction.findMany({
    where: { publish: "PUBLISHED", object: { publish: "PUBLISHED", region: { status: "PUBLISHED" } } },
    include: { object: { select: { id: true, name: true, region: { select: { name: true } } } } },
    take: 500,
  });
  const lots: PublicAuction[] = rows.map((a) => ({
    id: a.id,
    status: a.status,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    startPriceUsd: a.startPriceUsd,
    finalPriceUsd: a.finalPriceUsd,
    terms: asLocalized(a.terms),
    resultNote: asLocalized(a.resultNote),
    object: { id: a.object.id, name: asLocalized(a.object.name), regionName: asLocalized(a.object.region.name) },
  }));
  return {
    current: lots.filter((l) => l.status === "SCHEDULED" || l.status === "OPEN").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    finished: lots.filter((l) => l.status === "CLOSED" || l.status === "CANCELLED").sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime()),
  };
}
