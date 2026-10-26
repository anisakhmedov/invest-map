"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requestIp as ip } from "@/lib/request-ip";
import { buildAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { deliverPending, queueEmail } from "@/lib/mailer";
import { can, canAccessAdmin } from "@/lib/rbac";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { loadDictionary } from "@/i18n/load-dictionary";
import { trackingLinkFor } from "@/features/requests/links";
import { excerpt, renderMail } from "@/features/requests/mail";
import { REQUEST_STATUSES, staffReplySchema, taskInputSchema } from "@/features/requests/schemas";
import { requestSettingsSchema } from "@/features/requests/settings";
import { firstResponseAfter, statusAfterStaffMessage } from "@/features/requests/sla";

export type StaffResult = { ok: true; id: string } | { ok: false; error: string };

const loc = (lang: string) => (hasLocale(lang) ? lang : defaultLocale);

async function audit(userId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
  await db.auditLog.create({ data: buildAuditEntry({ userId, action, entity, entityId, before, after, ip: await ip() }) });
}

function refresh(lang: string, id?: string) {
  revalidatePath(`/${loc(lang)}/admin/requests`);
  if (id) revalidatePath(`/${loc(lang)}/admin/requests/${id}`);
  revalidatePath(`/${loc(lang)}/admin`);
}

// ---------- requests ----------

export async function replyAsStaff(lang: string, id: string, input: unknown): Promise<StaffResult> {
  const user = await requirePermission(lang, "request", "update");
  const parsed = staffReplySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const request = await db.request.findUnique({ where: { id } });
  if (!request) return { ok: false, error: "notFound" };

  const { body, internal } = parsed.data;
  const now = new Date();
  const status = statusAfterStaffMessage(request.status, internal);
  const [message] = await db.$transaction([
    db.requestMessage.create({ data: { requestId: id, fromStaff: true, userId: user.id, body, internal } }),
    db.request.update({
      where: { id },
      data: {
        status,
        firstResponseAt: firstResponseAfter(request.firstResponseAt, internal, now),
        closedAt: status === "CLOSED" ? request.closedAt : null,
      },
    }),
  ]);
  await audit(user.id, internal ? "request.note" : "request.reply", "Request", id, { status: request.status }, { status, messageId: message.id });

  if (!internal) {
    const link = trackingLinkFor(request);
    if (link) {
      const dict = await loadDictionary(hasLocale(request.locale) ? request.locale : defaultLocale);
      await queueEmail(request.contactEmail, renderMail(dict.mail.reply, { number: request.number, name: request.contactName, excerpt: excerpt(body), url: link }));
      after(() => deliverPending().catch(() => undefined));
    }
  }
  refresh(lang, id);
  return { ok: true, id: message.id };
}

export async function setRequestStatus(lang: string, id: string, status: unknown): Promise<StaffResult> {
  const user = await requirePermission(lang, "request", "update");
  if (typeof status !== "string" || !(REQUEST_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "invalid" };
  const before = await db.request.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  const next = status as (typeof REQUEST_STATUSES)[number];

  await db.request.update({ where: { id }, data: { status: next, closedAt: next === "CLOSED" ? (before.closedAt ?? new Date()) : null } });
  await audit(user.id, "request.status", "Request", id, { status: before.status }, { status: next });
  refresh(lang, id);
  return { ok: true, id };
}

/** Passing null removes the assignee. Only active staff who can see requests may be assigned. */
export async function assignRequest(lang: string, id: string, assigneeId: unknown): Promise<StaffResult> {
  const user = await requirePermission(lang, "request", "update");
  if (assigneeId !== null && (typeof assigneeId !== "string" || assigneeId.length > 40)) return { ok: false, error: "invalid" };
  const before = await db.request.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };

  if (assigneeId) {
    const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { isActive: true, role: { select: { key: true } } } });
    if (!assignee?.isActive || !canAccessAdmin(assignee.role.key) || !can(assignee.role.key, "request", "view")) {
      return { ok: false, error: "invalidAssignee" };
    }
  }
  await db.request.update({ where: { id }, data: { assigneeId, ...(assigneeId && before.status === "NEW" ? { status: "IN_PROGRESS" } : {}) } });
  await audit(user.id, "request.assign", "Request", id, { assigneeId: before.assigneeId }, { assigneeId });
  refresh(lang, id);
  return { ok: true, id };
}

// ---------- tasks ----------

export async function saveTask(lang: string, id: string | null, input: unknown): Promise<StaffResult> {
  const user = await requirePermission(lang, "task", id ? "update" : "create");
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const t = parsed.data;

  if (t.assigneeId) {
    const assignee = await db.user.findUnique({ where: { id: t.assigneeId }, select: { isActive: true, role: { select: { key: true } } } });
    if (!assignee?.isActive || !canAccessAdmin(assignee.role.key)) return { ok: false, error: "invalidAssignee" };
  }
  if (t.requestId && !(await db.request.findUnique({ where: { id: t.requestId }, select: { id: true } }))) return { ok: false, error: "unknownRequest" };

  const before = id ? await db.task.findUnique({ where: { id } }) : null;
  if (id && !before) return { ok: false, error: "notFound" };

  const data = {
    title: t.title,
    description: t.description,
    status: t.status,
    dueAt: t.dueAt,
    assigneeId: t.assigneeId,
    requestId: t.requestId,
    completedAt: t.status === "DONE" ? (before?.completedAt ?? new Date()) : null,
  };
  const saved = id ? await db.task.update({ where: { id }, data }) : await db.task.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, id ? "task.update" : "task.create", "Task", saved.id, before, saved);
  revalidatePath(`/${loc(lang)}/admin/tasks`);
  revalidatePath(`/${loc(lang)}/admin`);
  return { ok: true, id: saved.id };
}

export async function deleteTask(lang: string, id: string): Promise<StaffResult> {
  const user = await requirePermission(lang, "task", "delete");
  const before = await db.task.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "notFound" };
  await db.task.delete({ where: { id } });
  await audit(user.id, "task.delete", "Task", id, before, null);
  revalidatePath(`/${loc(lang)}/admin/tasks`);
  revalidatePath(`/${loc(lang)}/admin`);
  return { ok: true, id };
}

// ---------- settings ----------

export async function saveRequestSettings(lang: string, input: unknown): Promise<StaffResult> {
  const user = await requirePermission(lang, "settings", "update");
  const parsed = requestSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const before = await db.siteSetting.findUnique({ where: { key: "requests" } });
  await db.siteSetting.upsert({ where: { key: "requests" }, update: { value: parsed.data }, create: { key: "requests", value: parsed.data } });
  await audit(user.id, "settings.update", "SiteSetting", "requests", before?.value, parsed.data);
  revalidatePath(`/${loc(lang)}/admin/settings`);
  return { ok: true, id: "requests" };
}

// Thin wrapper for <form action>, which must return nothing.
export async function removeTask(lang: string, id: string): Promise<void> {
  await deleteTask(lang, id);
}
