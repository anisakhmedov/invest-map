import { z } from "zod";
import { locales } from "@/i18n/config";

export const REQUEST_STATUSES = ["NEW", "IN_PROGRESS", "ANSWERED", "CLOSED"] as const;
export type RequestStatusKey = (typeof REQUEST_STATUSES)[number];

export const TASK_STATUSES = ["TODO", "DOING", "DONE"] as const;
export type TaskStatusKey = (typeof TASK_STATUSES)[number];

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const requestInputSchema = z.object({
  subject: text(3, 200),
  message: text(10, 5000),
  contactName: text(2, 120),
  contactEmail: z.string().trim().toLowerCase().email().max(254),
  contactPhone: z.string().trim().max(40).regex(/^[+\d\s()-]*$/, "phone"),
  objectId: z.string().trim().max(40),
  locale: z.enum(locales),
});
export type RequestInput = z.infer<typeof requestInputSchema>;

export const visitorReplySchema = z.object({ body: text(1, 5000) });

export const staffReplySchema = z.object({
  body: text(1, 5000),
  internal: z.boolean(),
});

const dateString = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "date")
  .transform((v) => new Date(v));

export const taskInputSchema = z.object({
  title: text(3, 200),
  description: z.string().trim().max(5000),
  status: z.enum(TASK_STATUSES),
  dueAt: dateString.nullable(),
  assigneeId: z.string().max(40).nullable(),
  requestId: z.string().max(40).nullable(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;
