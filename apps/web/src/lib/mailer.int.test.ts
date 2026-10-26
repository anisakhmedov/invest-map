import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

const sendMail = vi.fn(async () => {
  await new Promise((r) => setTimeout(r, 30)); // slow enough for two callers to overlap
});
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

process.env.SMTP_URL = "smtp://user:pass@smtp.example.test:587";
const { deliverPending, queueEmail } = await import("./mailer");

const tag = `mit${Date.now()}`;

beforeAll(async () => {
  // Anything already waiting in the shared dev database must not be sent by this test.
  await db.emailOutbox.updateMany({ where: { status: "PENDING" }, data: { status: "FAILED", error: `${tag} parked` } });
});

afterAll(async () => {
  await db.emailOutbox.deleteMany({ where: { toEmail: { startsWith: tag } } });
  await db.emailOutbox.updateMany({ where: { error: `${tag} parked` }, data: { status: "PENDING", error: null } });
  await db.$disconnect();
});

describe("deliverPending", () => {
  it("sends each queued message once even when two callers overlap", async () => {
    await queueEmail(`${tag}.a@example.test`, { subject: "One", body: "first" });
    await queueEmail(`${tag}.b@example.test`, { subject: "Two", body: "second" });

    const [a, b] = await Promise.all([deliverPending(), deliverPending()]);

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(a).toEqual(b); // they shared one run
    expect(a.sent).toBe(2);
    const rows = await db.emailOutbox.findMany({ where: { toEmail: { startsWith: tag } } });
    expect(rows.map((r) => [r.status, r.attempts])).toEqual([["SENT", 1], ["SENT", 1]]);
  });

  it("can run again after a batch finished", async () => {
    await queueEmail(`${tag}.c@example.test`, { subject: "Three", body: "third" });
    const result = await deliverPending();
    expect(result.sent).toBe(1);
  });
});
