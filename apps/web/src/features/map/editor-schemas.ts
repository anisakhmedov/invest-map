import { z } from "zod";
import { cornersSchema, lineStringSchema, pointSchema } from "./geo";

const text = (max: number) => z.string().trim().max(max);
const localized = (max: number) => z.object({ uz: text(max), oz: text(max), ru: text(max), en: text(max) });

const status = z.enum(["DRAFT", "PUBLISHED"]);
const needsUzbekName = (v: { status: string; name: { uz: string } }) => v.status === "DRAFT" || v.name.uz.length > 0;
const nameRule = { path: ["name"], message: "name_required" };

// Geometry is validated separately (validatePolygonGeometry etc.) so errors can name the exact problem.
export const regionInputSchema = z
  .object({ name: localized(200), description: localized(2000), status, geometry: z.unknown() })
  .refine(needsUzbekName, nameRule);

export const roadInputSchema = z
  .object({ name: localized(200), kind: z.enum(["road", "rail"]), status, geometry: lineStringSchema })
  .refine(needsUzbekName, nameRule);

export const stopInputSchema = z
  .object({ name: localized(200), kind: z.enum(["bus", "train", "other"]), status, point: pointSchema })
  .refine(needsUzbekName, nameRule);

export const planInputSchema = z
  .object({
    name: localized(200),
    mediaId: z.string().min(1).max(40),
    corners: z.unknown(),
    opacity: z.number().min(0.05).max(1),
    status,
  })
  .refine(needsUzbekName, nameRule);

export { cornersSchema };
