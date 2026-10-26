"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildAuditEntry } from "@/lib/audit";
import { clientIpFrom } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { deliverPending, queueEmail } from "@/lib/mailer";
import { MAX_UPLOAD_BYTES, buildObjectKey, checkUpload, sanitizeFilename } from "@/lib/media";
import { createRateLimiter } from "@/lib/rate-limit";
import { deleteObject, putObject } from "@/lib/s3";
import { SITE_URL } from "@/lib/seo";
import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";
import { loadDictionary } from "@/i18n/load-dictionary";
import { excerpt, renderMail } from "@/features/requests/mail";
import { requestInputSchema, visitorReplySchema } from "@/features/requests/schemas";
import { getRequestSettings } from "@/features/requests/settings";
import { computeDueAt, statusAfterVisitorMessage } from "@/features/requests/sla";
import { checkFormToken, spamReasons } from "@/features/requests/spam";
import { authSecret as secret, trackingUrl } from "@/features/requests/links";
import { encryptToken } from "@/features/requests/token-crypto";
import { hashTrackingToken, isPlausibleToken, newTrackingToken } from "@/features/requests/tracking";

export type RequestFormState = { error?: string; field?: string } | undefined;
export type ReplyState = { error?: string; saved?: boolean } | undefined;

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Public forms are the main target for abuse, so they are limited per address, per email and per request.
const ipLimiter = createRateLimiter(5, 60 * 60 * 1000);
const emailLimiter = createRateLimiter(10, 24 * 60 * 60 * 1000);
const replyLimiter = createRateLimiter(10, 60 * 60 * 1000);

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function ip() {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

export async function submitRequest(lang: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const locale: Locale = hasLocale(lang) ? lang : defaultLocale;
  const address = await ip();

  const tokenState = checkFormToken(formData.get("ft"), secret());
  if (tokenState === "too_fast") return { error: "tooFast" };
  if (tokenState !== "ok") return { error: "formExpired" };
  if (!ipLimiter.check(address).allowed) return { error: "rateLimited" };

  const parsed = requestInputSchema.safeParse({
    subject: str(formData.get("subject")),
    message: str(formData.get("message")),
    contactName: str(formData.get("contactName")),
    contactEmail: str(formData.get("contactEmail")),
    contactPhone: str(formData.get("contactPhone")),
    objectId: str(formData.get("objectId")),
    locale,
  });
  if (!parsed.success) return { error: "invalid", field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const input = parsed.data;

  // Bots get the same plain refusal whatever tripped the check, so they learn nothing about it.
  if (spamReasons({ honeypot: str(formData.get("website")), subject: input.subject, message: input.message }).length > 0) {
    return { error: "rejected" };
  }
  if (!emailLimiter.check(input.contactEmail).allowed) return { error: "rateLimited" };

  let object: { id: string; name: unknown } | null = null;
  if (input.objectId) {
    object = await db.investObject.findFirst({ where: { id: input.objectId, publish: "PUBLISHED" }, select: { id: true, name: true } });
    if (!object) return { error: "unknownObject" };
  }

  // Check every file before storing anything, so a bad third file does not leave two orphans behind.
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES) return { error: "tooManyFiles" };
  const prepared: { bytes: Uint8Array; mime: string; name: string }[] = [];
  for (const file of files) {
    if (file.size > Math.min(MAX_FILE_BYTES, MAX_UPLOAD_BYTES)) return { error: "fileTooLarge" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkUpload(bytes);
    if (!check.ok) return { error: check.reason === "too_large" ? "fileTooLarge" : "unsupportedFile" };
    prepared.push({ bytes, mime: check.mime, name: sanitizeFilename(file.name) });
  }

  const stored: { key: string; filename: string; mimeType: string; size: number }[] = [];
  try {
    for (const f of prepared) {
      const key = buildObjectKey(f.mime as Parameters<typeof buildObjectKey>[0], new Date(), "requests");
      await putObject(key, f.bytes, f.mime);
      stored.push({ key, filename: f.name, mimeType: f.mime, size: f.bytes.length });
    }
  } catch {
    await Promise.all(stored.map((s) => deleteObject(s.key).catch(() => undefined)));
    return { error: "storageUnavailable" };
  }

  const settings = await getRequestSettings();
  const { token, hash } = newTrackingToken();
  const now = new Date();
  let request;
  try {
    request = await db.request.create({
      data: {
        trackingHash: hash,
        trackingEnc: encryptToken(token, secret()),
        objectId: object?.id ?? null,
        subject: input.subject,
        message: input.message,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone || null,
        locale,
        dueAt: computeDueAt(now, settings.slaHours),
        ip: address,
        attachments: { create: stored },
      },
    });
  } catch (e) {
    await Promise.all(stored.map((s) => deleteObject(s.key).catch(() => undefined)));
    throw e;
  }

  await db.auditLog.create({
    data: buildAuditEntry({ action: "request.create", entity: "Request", entityId: request.id, after: { number: request.number, objectId: request.objectId }, ip: address }),
  });

  const [visitorDict, staffDict] = await Promise.all([loadDictionary(locale), loadDictionary(defaultLocale)]);
  const vars = { number: request.number, name: input.contactName, subject: input.subject, url: trackingUrl(locale, token), excerpt: excerpt(input.message) };
  await queueEmail(input.contactEmail, renderMail(visitorDict.mail.received, vars));
  if (settings.notifyEmail) {
    await queueEmail(settings.notifyEmail, renderMail(staffDict.mail.staffNew, { ...vars, adminUrl: `${SITE_URL}/${defaultLocale}/admin/requests/${request.id}` }));
  }
  after(() => deliverPending().catch(() => undefined));

  redirect(`/${locale}/request/track/${token}`);
}

export async function replyToRequest(_lang: string, token: string, _prev: ReplyState, formData: FormData): Promise<ReplyState> {
  if (!isPlausibleToken(token)) return { error: "notFound" };

  const parsed = visitorReplySchema.safeParse({ body: str(formData.get("body")) });
  if (!parsed.success) return { error: "invalid" };

  const hash = hashTrackingToken(token);
  if (!replyLimiter.check(hash).allowed) return { error: "rateLimited" };
  if (spamReasons({ honeypot: str(formData.get("website")), subject: "", message: parsed.data.body }).length > 0) return { error: "rejected" };

  const request = await db.request.findUnique({ where: { trackingHash: hash } });
  if (!request) return { error: "notFound" };
  const outcome = statusAfterVisitorMessage(request.status);
  if (!outcome.allowed) return { error: "closed" };

  await db.$transaction([
    db.requestMessage.create({ data: { requestId: request.id, fromStaff: false, body: parsed.data.body } }),
    db.request.update({ where: { id: request.id }, data: { status: outcome.status } }),
  ]);

  const settings = await getRequestSettings();
  const recipients = new Set<string>();
  if (settings.notifyEmail) recipients.add(settings.notifyEmail);
  if (request.assigneeId) {
    const assignee = await db.user.findUnique({ where: { id: request.assigneeId }, select: { email: true, isActive: true } });
    if (assignee?.isActive) recipients.add(assignee.email);
  }
  if (recipients.size > 0) {
    const staffDict = await loadDictionary(defaultLocale);
    const mail = renderMail(staffDict.mail.staffReply, {
      number: request.number,
      name: request.contactName,
      excerpt: excerpt(parsed.data.body),
      adminUrl: `${SITE_URL}/${defaultLocale}/admin/requests/${request.id}`,
    });
    for (const to of recipients) await queueEmail(to, mail);
    after(() => deliverPending().catch(() => undefined));
  }

  return { saved: true };
}
