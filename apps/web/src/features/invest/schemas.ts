import { z } from "zod";
import { OBJECT_CATEGORIES, OBJECT_STATUSES } from "@/features/map/model";

const text = (max: number) => z.string().trim().max(max);
const localized = (max: number) => z.object({ uz: text(max), oz: text(max), ru: text(max), en: text(max) });
const publish = z.enum(["DRAFT", "PUBLISHED"]);

export const objectInputSchema = z
  .object({
    regionId: z.string().min(1).max(40),
    name: localized(200),
    description: localized(2000),
    category: z.enum(OBJECT_CATEGORIES),
    status: z.enum(OBJECT_STATUSES),
    areaHa: z.number().positive().max(10_000_000),
    priceUsd: z.number().min(0).max(1e12).nullable(),
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
    publish,
    contactName: text(120),
    contactPhone: text(40),
    contactEmail: text(254).refine((v) => v === "" || z.string().email().safeParse(v).success, "email"),
  })
  .refine((o) => o.publish === "DRAFT" || o.name.uz.length > 0, { path: ["name"], message: "name_required" });

export type ObjectInput = z.infer<typeof objectInputSchema>;

const date = z
  .string()
  .refine((v) => {
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100;
  }, "date")
  .transform((v) => new Date(v));

export const AUCTION_STATUSES = ["SCHEDULED", "OPEN", "CLOSED", "CANCELLED"] as const;
export type AuctionStatusKey = (typeof AUCTION_STATUSES)[number];

export const auctionInputSchema = z
  .object({
    objectId: z.string().min(1).max(40),
    status: z.enum(AUCTION_STATUSES),
    publish,
    startsAt: date,
    endsAt: date,
    startPriceUsd: z.number().positive().max(1e12),
    terms: localized(5000),
    finalPriceUsd: z.number().min(0).max(1e12).nullable(),
    resultNote: localized(2000),
  })
  .refine((a) => a.endsAt > a.startsAt, { path: ["endsAt"], message: "ends_before_start" })
  .refine((a) => a.finalPriceUsd === null || a.status === "CLOSED", { path: ["finalPriceUsd"], message: "result_needs_closed" });

export type AuctionInput = z.infer<typeof auctionInputSchema>;
