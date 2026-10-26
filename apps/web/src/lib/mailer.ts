import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { sanitizeSubject, type MailTemplate } from "@/features/requests/mail";

const MAX_ATTEMPTS = 5;
let transport: Transporter | null = null;

/** Mail goes out only when SMTP_URL is set, e.g. smtp://user:password@smtp.example.uz:587. */
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL);
}

function getTransport(): Transporter | null {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  transport ??= nodemailer.createTransport(url);
  return transport;
}

/** Stores a message in the outbox. It is delivered by deliverPending(), now or later. */
export async function queueEmail(to: string, mail: MailTemplate): Promise<void> {
  await db.emailOutbox.create({
    data: { toEmail: to.trim().toLowerCase().slice(0, 254), subject: sanitizeSubject(mail.subject), body: mail.body.slice(0, 20_000) },
  });
}

export type DeliveryResult = { sent: number; failed: number; configured: boolean };

let running: Promise<DeliveryResult> | null = null;

/**
 * Sends waiting messages. Failures are retried on the next call and give up after MAX_ATTEMPTS.
 * Calls that overlap share one run: two requests arriving together would otherwise pick the same rows and send each message twice.
 */
export function deliverPending(limit = 20): Promise<DeliveryResult> {
  running ??= sendBatch(limit).finally(() => {
    running = null;
  });
  return running;
}

async function sendBatch(limit: number): Promise<DeliveryResult> {
  const t = getTransport();
  if (!t) return { sent: 0, failed: 0, configured: false };

  const rows = await db.emailOutbox.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await t.sendMail({
        from: process.env.MAIL_FROM ?? "InvestMap <no-reply@localhost>",
        to: row.toEmail,
        subject: row.subject,
        text: row.body,
      });
      await db.emailOutbox.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, error: null } });
      sent++;
    } catch (e) {
      failed++;
      const attempts = row.attempts + 1;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { attempts, status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING", error: String((e as Error).message).slice(0, 300) },
      });
    }
  }
  return { sent, failed, configured: true };
}
