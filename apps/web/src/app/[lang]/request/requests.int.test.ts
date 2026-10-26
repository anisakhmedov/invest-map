import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { deleteObject } from "@/lib/s3";
import { createFormToken } from "@/features/requests/spam";
import { hashTrackingToken } from "@/features/requests/tracking";
import { decryptToken } from "@/features/requests/token-crypto";
import { hashPassword } from "@/lib/password";

let role = "SUPER_ADMIN";
let userId = "";
let signedIn = true;
let forwardedFor = "198.51.100.10";

vi.mock("@/lib/auth", () => ({
  requirePermission: async (_lang: string, resource: never, action: never) => {
    if (!can(role, resource, action)) throw new Error("FORBIDDEN");
    return { id: userId, email: "admin@investmap.local", fullName: "Test", role };
  },
  getCurrentUser: async () => (signedIn ? { id: userId, email: "admin@investmap.local", fullName: "Test", role } : null),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": forwardedFor }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: () => undefined }));

const pub = await import("./actions");
const staff = await import("../admin/request-actions");
const { GET: downloadAttachment } = await import("@/app/api/requests/attachments/[id]/route");
const { GET: reportCsv } = await import("@/app/api/reports/requests/route");
const mailer = await import("@/lib/mailer");

const tag = `itreq${Date.now()}`;
const domain = "@it-req.test";
const startedAt = new Date();
const staffMail = `staff-${tag}${domain}`;
const secret = process.env.AUTH_SECRET!;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHrW7DAAAAABJRU5ErkJggg==", "base64");

let unique = 0;
const nextIp = () => `198.51.100.${100 + ++unique}`;
const email = (label: string) => `${label}-${tag}${domain}`;
let publishedObjectId = "";
let draftObjectId = "";
let regionId = "";
let hadSettings: unknown = undefined;

function form(entries: Record<string, string | Blob | Blob[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach((f) => fd.append(k, f));
    else fd.append(k, v);
  }
  return fd;
}

const goodFields = (over: Record<string, string | Blob | Blob[]> = {}): Record<string, string | Blob | Blob[]> => ({
  subject: "Plot near the highway",
  message: "Is the plot near the highway still available for lease?",
  contactName: "Aziz Karimov",
  contactEmail: email("aziz"),
  contactPhone: "+998 90 123 45 67",
  objectId: "",
  website: "",
  ft: createFormToken(secret, Date.now() - 5000),
  ...over,
});

async function submit(fields: Record<string, string | Blob | Blob[]>, lang = "uz") {
  try {
    const res = await pub.submitRequest(lang, undefined, form(fields));
    return { error: res?.error, field: res?.field } as { error?: string; field?: string; token?: string; path?: string };
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (!m) throw e;
    return { path: m[1], token: m[1].split("/").pop() };
  }
}

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: "admin@investmap.local" } })).id;
  const region = await db.region.create({
    data: { slug: `${tag}-region`, status: "PUBLISHED", name: { uz: `${tag} Hudud` }, description: {}, geometry: { type: "Polygon", coordinates: [[[60, 40], [61, 40], [61, 41], [60, 41], [60, 40]]] }, centerLng: 60.5, centerLat: 40.5 },
  });
  regionId = region.id;
  const base = { regionId, name: { uz: tag }, description: {}, category: "industry", areaHa: 1, lng: 60.5, lat: 40.5 };
  publishedObjectId = (await db.investObject.create({ data: { ...base, slug: `${tag}-pub`, publish: "PUBLISHED" } })).id;
  draftObjectId = (await db.investObject.create({ data: { ...base, slug: `${tag}-draft`, publish: "DRAFT" } })).id;
  hadSettings = (await db.siteSetting.findUnique({ where: { key: "requests" } }))?.value;
  await staff.saveRequestSettings("en", { slaHours: 48, notifyEmail: staffMail });
});

beforeEach(() => {
  role = "SUPER_ADMIN";
  signedIn = true;
  forwardedFor = nextIp();
});

afterAll(async () => {
  const mine = await db.request.findMany({ where: { contactEmail: { endsWith: domain } }, include: { attachments: true } });
  for (const r of mine) for (const a of r.attachments) await deleteObject(a.key).catch(() => undefined);
  await db.request.deleteMany({ where: { contactEmail: { endsWith: domain } } });
  await db.task.deleteMany({ where: { title: { startsWith: tag } } });
  await db.emailOutbox.deleteMany({ where: { OR: [{ toEmail: { endsWith: domain } }, { createdAt: { gte: startedAt }, subject: { contains: tag } }] } });
  await db.region.deleteMany({ where: { slug: { startsWith: tag } } });
  await db.user.deleteMany({ where: { fullName: tag } });
  if (hadSettings === undefined) await db.siteSetting.deleteMany({ where: { key: "requests" } });
  else await db.siteSetting.update({ where: { key: "requests" }, data: { value: hadSettings as never } });
  await db.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, OR: [{ ip: { startsWith: "198.51.100." } }, { userId }] , action: { startsWith: "request" } } });
  await db.$disconnect();
});

describe("submitting a request", () => {
  it("creates the request, a private tracking link, emails and an audit entry", async () => {
    const res = await submit(goodFields({ contactEmail: email("first"), objectId: publishedObjectId }), "ru");
    expect(res.path).toMatch(/^\/ru\/request\/track\/[A-Za-z0-9_-]{32}$/);

    const request = await db.request.findUniqueOrThrow({ where: { trackingHash: hashTrackingToken(res.token!) } });
    expect(request).toMatchObject({ status: "NEW", contactEmail: email("first"), objectId: publishedObjectId, locale: "ru", ip: forwardedFor });
    expect(request.number).toBeGreaterThan(0);
    // SLA from settings (48 h)
    expect(request.dueAt.getTime() - request.createdAt.getTime()).toBeGreaterThan(47.9 * 3_600_000);
    expect(request.dueAt.getTime() - request.createdAt.getTime()).toBeLessThan(48.1 * 3_600_000);
    // the stored copy is encrypted but recoverable by the server
    expect(request.trackingEnc).not.toContain(res.token!);
    expect(decryptToken(request.trackingEnc, secret)).toBe(res.token);

    const mails = await db.emailOutbox.findMany({ where: { toEmail: { in: [email("first"), staffMail] }, createdAt: { gte: request.createdAt } } });
    const visitor = mails.find((m) => m.toEmail === email("first"))!;
    expect(visitor.subject).toContain(`№${request.number}`);
    expect(visitor.body).toContain(`/ru/request/track/${res.token}`);
    expect(mails.find((m) => m.toEmail === staffMail)?.body).toContain(`/admin/requests/${request.id}`);
    expect(await db.auditLog.count({ where: { action: "request.create", entityId: request.id } })).toBe(1);
  });

  it("rejects bad input with the field name and stores nothing", async () => {
    const before = await db.request.count();
    expect(await submit(goodFields({ subject: "hi" }))).toMatchObject({ error: "invalid", field: "subject" });
    expect(await submit(goodFields({ contactEmail: "nope" }))).toMatchObject({ error: "invalid", field: "contactEmail" });
    expect(await submit(goodFields({ contactPhone: "call me" }))).toMatchObject({ error: "invalid", field: "contactPhone" });
    expect(await submit(goodFields({ message: "short" }))).toMatchObject({ error: "invalid", field: "message" });
    expect(await db.request.count()).toBe(before);
  });

  it("refuses forged, instant and expired form tokens", async () => {
    expect((await submit(goodFields({ ft: "" }))).error).toBe("formExpired");
    expect((await submit(goodFields({ ft: createFormToken("another-secret-16-chars!", Date.now() - 5000) }))).error).toBe("formExpired");
    expect((await submit(goodFields({ ft: createFormToken(secret, Date.now()) }))).error).toBe("tooFast");
    expect((await submit(goodFields({ ft: createFormToken(secret, Date.now() - 3 * 3_600_000) }))).error).toBe("formExpired");
  });

  it("turns away bots: honeypot and link floods get a plain refusal and no record", async () => {
    const before = await db.request.count();
    expect((await submit(goodFields({ website: "http://spam.example" }))).error).toBe("rejected");
    expect((await submit(goodFields({ message: "Buy now http://a.co http://b.co http://c.co http://d.co please" }))).error).toBe("rejected");
    expect(await db.request.count()).toBe(before);
  });

  it("limits how often one address and one email can submit", async () => {
    forwardedFor = "198.51.100.77";
    let blocked = 0;
    for (let i = 0; i < 7; i++) {
      const res = await submit(goodFields({ contactEmail: email(`flood${i}`) }));
      if (res.error === "rateLimited") blocked++;
    }
    expect(blocked).toBe(2); // 5 per hour per address

    forwardedFor = nextIp();
    let emailBlocked = 0;
    for (let i = 0; i < 12; i++) {
      forwardedFor = nextIp();
      if ((await submit(goodFields({ contactEmail: email("same") }))).error === "rateLimited") emailBlocked++;
    }
    expect(emailBlocked).toBe(2); // 10 per day per email
  });

  it("only links published objects", async () => {
    expect((await submit(goodFields({ contactEmail: email("obj1"), objectId: draftObjectId }))).error).toBe("unknownObject");
    expect((await submit(goodFields({ contactEmail: email("obj2"), objectId: "no-such-object" }))).error).toBe("unknownObject");
  });

  it("accepts real files, keeps them private, and rejects disguised or oversized ones", async () => {
    const png = new File([PNG], "plan.png", { type: "application/octet-stream" });
    const ok = await submit(goodFields({ contactEmail: email("files") }), "uz");
    expect(ok.path).toBeTruthy();
    const withFile = await submit(goodFields({ contactEmail: email("files2"), files: [png] }));
    const request = await db.request.findUniqueOrThrow({ where: { trackingHash: hashTrackingToken(withFile.token!) }, include: { attachments: true } });
    expect(request.attachments).toHaveLength(1);
    expect(request.attachments[0]).toMatchObject({ filename: "plan.png", mimeType: "image/png" });
    expect(request.attachments[0].key).toMatch(/^requests\//);

    const before = await db.requestAttachment.count();
    const fake = new File(["<script>alert(1)</script>"], "evil.png", { type: "image/png" });
    expect((await submit(goodFields({ contactEmail: email("f3"), files: [fake] }))).error).toBe("unsupportedFile");
    const big = new File([Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])], "big.png");
    expect((await submit(goodFields({ contactEmail: email("f4"), files: [big] }))).error).toBe("fileTooLarge");
    const four = [1, 2, 3, 4].map((i) => new File([PNG], `p${i}.png`));
    expect((await submit(goodFields({ contactEmail: email("f5"), files: four }))).error).toBe("tooManyFiles");
    expect(await db.requestAttachment.count()).toBe(before);
  });
});

describe("following up as a visitor", () => {
  async function newRequest(label: string) {
    const res = await submit(goodFields({ contactEmail: email(label) }));
    const request = await db.request.findUniqueOrThrow({ where: { trackingHash: hashTrackingToken(res.token!) } });
    return { token: res.token!, request };
  }
  const reply = (token: string, body: string, website = "") => pub.replyToRequest("uz", token, undefined, form({ body, website }));

  it("adds a message, reopens an answered request and notifies staff", async () => {
    const { token, request } = await newRequest("reply1");
    await staff.replyAsStaff("en", request.id, { body: "We have the details.", internal: false });
    expect((await db.request.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("ANSWERED");

    expect(await reply(token, "Thank you, one more question.")).toEqual({ saved: true });
    const after = await db.request.findUniqueOrThrow({ where: { id: request.id }, include: { messages: true } });
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.messages.filter((m) => !m.fromStaff)).toHaveLength(1);
    expect(await db.emailOutbox.count({ where: { toEmail: staffMail, body: { contains: "one more question" }, createdAt: { gte: request.createdAt } } })).toBe(1);
  });

  it("refuses unknown tokens, empty text, bots and closed requests", async () => {
    expect(await reply("x".repeat(32), "Hello?")).toEqual({ error: "notFound" });
    expect(await reply("short", "Hello?")).toEqual({ error: "notFound" });
    const { token, request } = await newRequest("reply2");
    expect(await reply(token, "   ")).toEqual({ error: "invalid" });
    expect(await reply(token, "hello", "http://bot")).toEqual({ error: "rejected" });
    await staff.setRequestStatus("en", request.id, "CLOSED");
    expect(await reply(token, "Can I still write?")).toEqual({ error: "closed" });
  });

  it("limits follow-ups per request", async () => {
    const { token } = await newRequest("reply3");
    const results = [];
    for (let i = 0; i < 12; i++) results.push(await reply(token, `Message ${i}`));
    expect(results.filter((r) => r?.error === "rateLimited")).toHaveLength(2);
  });
});

describe("staff handling", () => {
  async function newRequest(label: string) {
    const res = await submit(goodFields({ contactEmail: email(label), contactName: "Dilnoza" }));
    return db.request.findUniqueOrThrow({ where: { trackingHash: hashTrackingToken(res.token!) } });
  }

  it("a public reply answers, stamps the first response and emails the visitor with the private link", async () => {
    const request = await newRequest("staff1");
    const res = await staff.replyAsStaff("en", request.id, { body: "The plot is available.", internal: false });
    expect(res.ok).toBe(true);
    const row = await db.request.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe("ANSWERED");
    expect(row.firstResponseAt).not.toBeNull();

    const mail = await db.emailOutbox.findFirstOrThrow({ where: { toEmail: email("staff1"), body: { contains: "The plot is available." } } });
    expect(mail.body).toMatch(/\/uz\/request\/track\/[A-Za-z0-9_-]{32}/);

    // a second reply keeps the original first-response time
    await staff.replyAsStaff("en", request.id, { body: "Anything else?", internal: false });
    expect((await db.request.findUniqueOrThrow({ where: { id: request.id } })).firstResponseAt?.getTime()).toBe(row.firstResponseAt?.getTime());
  });

  it("an internal note changes nothing for the visitor", async () => {
    const request = await newRequest("staff2");
    const mailsBefore = await db.emailOutbox.count({ where: { toEmail: email("staff2") } });
    await staff.replyAsStaff("en", request.id, { body: "Owner prefers a long lease.", internal: true });
    const row = await db.request.findUniqueOrThrow({ where: { id: request.id } });
    expect(row).toMatchObject({ status: "NEW", firstResponseAt: null });
    expect(await db.emailOutbox.count({ where: { toEmail: email("staff2") } })).toBe(mailsBefore);
    expect(await db.requestMessage.count({ where: { requestId: request.id, internal: true } })).toBe(1);
  });

  it("changes status with closing time, and rejects unknown statuses", async () => {
    const request = await newRequest("staff3");
    await staff.setRequestStatus("en", request.id, "CLOSED");
    expect((await db.request.findUniqueOrThrow({ where: { id: request.id } })).closedAt).not.toBeNull();
    await staff.setRequestStatus("en", request.id, "IN_PROGRESS");
    expect((await db.request.findUniqueOrThrow({ where: { id: request.id } })).closedAt).toBeNull();
    expect(await staff.setRequestStatus("en", request.id, "DONE")).toEqual({ ok: false, error: "invalid" });
    expect(await staff.setRequestStatus("en", "missing", "CLOSED")).toEqual({ ok: false, error: "notFound" });
  });

  it("assigns only active staff and starts work on new requests", async () => {
    const request = await newRequest("staff4");
    expect(await staff.assignRequest("en", request.id, userId)).toEqual({ ok: true, id: request.id });
    expect(await db.request.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ assigneeId: userId, status: "IN_PROGRESS" });

    const roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.key, r.id]));
    const passwordHash = await hashPassword("Correct-horse-123");
    const investor = await db.user.create({ data: { email: `inv-${tag}${domain}`, passwordHash, fullName: tag, roleId: roles.INVESTOR } });
    const inactive = await db.user.create({ data: { email: `off-${tag}${domain}`, passwordHash, fullName: tag, roleId: roles.ADMIN, isActive: false } });
    expect(await staff.assignRequest("en", request.id, investor.id)).toEqual({ ok: false, error: "invalidAssignee" });
    expect(await staff.assignRequest("en", request.id, inactive.id)).toEqual({ ok: false, error: "invalidAssignee" });
    expect(await staff.assignRequest("en", request.id, { evil: 1 })).toEqual({ ok: false, error: "invalid" });
    expect(await staff.assignRequest("en", request.id, null)).toEqual({ ok: true, id: request.id });
  });

  it("enforces roles on the server", async () => {
    const request = await newRequest("staff5");
    role = "INVESTOR";
    await expect(staff.replyAsStaff("en", request.id, { body: "x", internal: false })).rejects.toThrow("FORBIDDEN");
    role = "CONTENT_EDITOR";
    await expect(staff.setRequestStatus("en", request.id, "CLOSED")).rejects.toThrow("FORBIDDEN");
    await expect(staff.saveTask("en", null, { title: `${tag} t`, description: "", status: "TODO", dueAt: null, assigneeId: null, requestId: null })).rejects.toThrow("FORBIDDEN");
    role = "MAP_EDITOR";
    await expect(staff.assignRequest("en", request.id, null)).rejects.toThrow("FORBIDDEN");
    role = "REQUEST_MANAGER";
    expect((await staff.replyAsStaff("en", request.id, { body: "I can help.", internal: true })).ok).toBe(true);
  });
});

describe("tasks", () => {
  const task = (over: Record<string, unknown> = {}) => ({ title: `${tag} call the owner`, description: "", status: "TODO", dueAt: "2027-05-01T10:00:00Z", assigneeId: null, requestId: null, ...over });

  it("creates, completes, updates and deletes with audit entries", async () => {
    const created = await staff.saveTask("en", null, task());
    if (!created.ok) throw new Error(created.error);
    expect(await db.task.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: "TODO", createdById: userId, completedAt: null });

    await staff.saveTask("en", created.id, task({ status: "DONE" }));
    expect((await db.task.findUniqueOrThrow({ where: { id: created.id } })).completedAt).not.toBeNull();
    await staff.saveTask("en", created.id, task({ status: "DOING" }));
    expect((await db.task.findUniqueOrThrow({ where: { id: created.id } })).completedAt).toBeNull();

    expect(await staff.deleteTask("en", created.id)).toEqual({ ok: true, id: created.id });
    expect(await staff.deleteTask("en", created.id)).toEqual({ ok: false, error: "notFound" });
    expect(await db.auditLog.count({ where: { entityId: created.id, action: { startsWith: "task." } } })).toBe(4);
  });

  it("validates input and links", async () => {
    expect(await staff.saveTask("en", null, task({ title: "x" }))).toEqual({ ok: false, error: "invalid" });
    expect(await staff.saveTask("en", null, task({ dueAt: "garbage" }))).toEqual({ ok: false, error: "invalid" });
    expect(await staff.saveTask("en", null, task({ status: "WAITING" }))).toEqual({ ok: false, error: "invalid" });
    expect(await staff.saveTask("en", null, task({ requestId: "missing" }))).toEqual({ ok: false, error: "unknownRequest" });
    expect(await staff.saveTask("en", null, task({ assigneeId: "missing" }))).toEqual({ ok: false, error: "invalidAssignee" });
    expect(await staff.saveTask("en", "missing", task())).toEqual({ ok: false, error: "notFound" });
  });
});

describe("downloads and reports", () => {
  it("serves attachments only to staff, as downloads", async () => {
    const res = await submit(goodFields({ contactEmail: email("dl"), files: [new File([PNG], "my plan.png")] }));
    const request = await db.request.findUniqueOrThrow({ where: { trackingHash: hashTrackingToken(res.token!) }, include: { attachments: true } });
    const ctx = { params: Promise.resolve({ id: request.attachments[0].id }) } as never;

    const ok = await downloadAttachment(new Request("http://x"), ctx);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toContain("attachment");
    expect(ok.headers.get("content-disposition")).toContain("my%20plan.png");
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect(ok.headers.get("content-security-policy")).toContain("sandbox");
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(new Uint8Array(PNG));

    signedIn = false;
    expect((await downloadAttachment(new Request("http://x"), ctx)).status).toBe(401);
    signedIn = true;
    role = "INVESTOR";
    expect((await downloadAttachment(new Request("http://x"), ctx)).status).toBe(403);
    role = "SUPER_ADMIN";
    expect((await downloadAttachment(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) } as never)).status).toBe(404);
  });

  it("exports the requests as CSV for staff with report access, neutralising formulas", async () => {
    await submit(goodFields({ contactEmail: email("csv"), contactName: "=HYPERLINK(\"http://evil\")" }));
    const res = await reportCsv(new Request("http://x/api/reports/requests"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split("\r\n")[0]).toContain("number,created_at,status");
    expect(text).toContain("'=HYPERLINK");
    expect(text).not.toMatch(/,=HYPERLINK/);

    const future = await reportCsv(new Request("http://x/api/reports/requests?from=2099-01-01&to=2099-01-31"));
    expect((await future.text()).trim().split("\r\n")).toHaveLength(1); // header only

    signedIn = false;
    expect((await reportCsv(new Request("http://x"))).status).toBe(401);
    signedIn = true;
    role = "CONTENT_EDITOR";
    expect((await reportCsv(new Request("http://x"))).status).toBe(403);
  });
});

describe("outgoing mail queue", () => {
  it("strips line breaks from subjects and keeps messages waiting while SMTP is not configured", async () => {
    const saved = process.env.SMTP_URL;
    delete process.env.SMTP_URL;
    await mailer.queueEmail(email("mail"), { subject: `${tag} Hi\r\nBcc: evil@example.com`, body: "body" });
    const row = await db.emailOutbox.findFirstOrThrow({ where: { toEmail: email("mail") } });
    expect(row.subject).not.toMatch(/[\r\n]/);
    expect(row.status).toBe("PENDING");

    expect(mailer.mailConfigured()).toBe(false);
    expect(await mailer.deliverPending()).toEqual({ sent: 0, failed: 0, configured: false });
    expect((await db.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PENDING");
    if (saved) process.env.SMTP_URL = saved;
  });
});
