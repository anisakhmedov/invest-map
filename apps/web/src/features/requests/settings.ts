import { z } from "zod";
import { db } from "@/lib/db";
import { DEFAULT_SLA_HOURS, MAX_SLA_HOURS } from "./sla";

export const requestSettingsSchema = z.object({
  slaHours: z.number().int().min(1).max(MAX_SLA_HOURS),
  notifyEmail: z.string().trim().max(254).refine((v) => v === "" || z.string().email().safeParse(v).success, "email"),
});
export type RequestSettings = z.infer<typeof requestSettingsSchema>;

const DEFAULTS: RequestSettings = { slaHours: DEFAULT_SLA_HOURS, notifyEmail: "" };

/** Reads the answer deadline and the staff notification address; bad or missing data gives defaults. */
export async function getRequestSettings(): Promise<RequestSettings> {
  const row = await db.siteSetting.findUnique({ where: { key: "requests" } });
  const parsed = requestSettingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : DEFAULTS;
}
