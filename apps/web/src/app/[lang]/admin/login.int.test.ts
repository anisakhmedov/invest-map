import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { resolveSession } from "@/lib/session-store";

let forwardedFor: string | null = null;
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => new Headers(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
  cookies: async () => ({
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { login, logout } = await import("./actions");

const tag = `it${Date.now()}`;
const password = "Correct-horse-123";
const startedAt = new Date();
const emails = {
  admin: `${tag}.admin@example.test`,
  investor: `${tag}.investor@example.test`,
  inactive: `${tag}.inactive@example.test`,
  victim: `${tag}.victim@example.test`,
  victim2: `${tag}.victim2@example.test`,
};
let uniqueIp = 0;
const nextIp = () => `198.51.100.${++uniqueIp}`;

const form = (email: string, pw: string) => {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", pw);
  return fd;
};

async function tryLogin(email: string, pw: string) {
  try {
    return await login("en", undefined, form(email, pw));
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return { redirect: m[1] };
    throw e;
  }
}

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  const roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.key, r.id]));
  const make = (email: string, role: string, isActive = true) =>
    db.user.create({ data: { email, passwordHash, fullName: tag, roleId: roles[role], isActive } });
  await Promise.all([
    make(emails.admin, "ADMIN"),
    make(emails.investor, "INVESTOR"),
    make(emails.inactive, "ADMIN", false),
    make(emails.victim, "ADMIN"),
    make(emails.victim2, "ADMIN"),
  ]);
});
beforeEach(() => {
  cookieJar.clear();
  forwardedFor = nextIp();
});
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, OR: [{ ip: { startsWith: "198.51.100." } }, { user: { fullName: tag } }] } });
  await db.user.deleteMany({ where: { fullName: tag } });
  await db.$disconnect();
});

describe("login", () => {
  it("signs in with the right password, sets a signed session cookie and audits it", async () => {
    const res = await tryLogin(emails.admin, password);
    expect(res).toEqual({ redirect: "/en/admin" });
    const session = verifySessionToken(cookieJar.get(SESSION_COOKIE));
    expect(session).toMatchObject({ role: "ADMIN" });
    const user = await db.user.findUniqueOrThrow({ where: { email: emails.admin } });
    expect(session?.sub).toBe(user.id);
    expect(await db.auditLog.count({ where: { userId: user.id, action: "auth.login" } })).toBe(1);
    // the cookie is backed by a server-side session row
    const row = await db.session.findUniqueOrThrow({ where: { id: session!.sid } });
    expect(row).toMatchObject({ userId: user.id, ip: forwardedFor });
    expect((await resolveSession(cookieJar.get(SESSION_COOKIE)))?.id).toBe(user.id);
  });

  it("gives the same answer for a wrong password and an unknown email, and sets no cookie", async () => {
    expect(await tryLogin(emails.admin, "wrong-password-1")).toEqual({ error: "invalid" });
    expect(await tryLogin(`${tag}.nobody@example.test`, password)).toEqual({ error: "invalid" });
    expect(cookieJar.size).toBe(0);
    expect(await db.auditLog.count({ where: { action: "auth.login_failed", ip: forwardedFor! } })).toBe(2);
  });

  it("rejects deactivated accounts even with the right password", async () => {
    expect(await tryLogin(emails.inactive, password)).toEqual({ error: "invalid" });
    expect(cookieJar.size).toBe(0);
  });

  it("does not let customers into the admin panel", async () => {
    expect(await tryLogin(emails.investor, password)).toEqual({ error: "forbidden" });
    expect(cookieJar.size).toBe(0);
  });

  it("rejects malformed input without touching the database", async () => {
    expect(await tryLogin("not-an-email", password)).toEqual({ error: "invalid" });
    expect(await tryLogin(emails.admin, "")).toEqual({ error: "invalid" });
    expect(await tryLogin(emails.admin, "x".repeat(201))).toEqual({ error: "invalid" });
  });

  it("logout clears the cookie, cancels the session on the server and goes to the login page", async () => {
    expect(await tryLogin(emails.admin, password)).toEqual({ redirect: "/en/admin" });
    const stolen = cookieJar.get(SESSION_COOKIE)!; // someone copied the cookie before sign-out
    expect(await resolveSession(stolen)).not.toBeNull();

    await expect(logout("ru")).rejects.toThrow("REDIRECT:/ru/admin/login");
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
    expect(await resolveSession(stolen)).toBeNull(); // the copied cookie is dead too
    const user = await db.user.findUniqueOrThrow({ where: { email: emails.admin } });
    expect(await db.auditLog.count({ where: { userId: user.id, action: "auth.logout" } })).toBeGreaterThanOrEqual(1);

    await expect(logout("//evil.example")).rejects.toThrow("REDIRECT:/uz/admin/login"); // no cookie: still safe
  });
});

describe("brute-force protection", () => {
  it("blocks the sixth attempt for the same address and account", async () => {
    forwardedFor = "198.51.100.200";
    for (let i = 0; i < 5; i++) expect(await tryLogin(emails.victim, `wrong-${i}-password`)).toEqual({ error: "invalid" });
    expect(await tryLogin(emails.victim, "wrong-5-password")).toEqual({ error: "tooMany" });
    // Even the correct password is refused while blocked.
    expect(await tryLogin(emails.victim, password)).toEqual({ error: "tooMany" });
  });

  it("cannot be bypassed by spoofing the first X-Forwarded-For entry", async () => {
    const proxyAdded = "198.51.100.201";
    for (let i = 0; i < 5; i++) {
      forwardedFor = `10.0.0.${i}, ${proxyAdded}`; // client-supplied junk first, our proxy's view last
      expect(await tryLogin(emails.victim2, `wrong-${i}-password`)).toEqual({ error: "invalid" });
    }
    forwardedFor = `10.9.9.9, ${proxyAdded}`;
    expect(await tryLogin(emails.victim2, "wrong-6-password")).toEqual({ error: "tooMany" });
  });

  it("also limits one account attacked from many addresses", async () => {
    const target = `${tag}.distributed@example.test`;
    let blocked = 0;
    for (let i = 0; i < 20; i++) {
      forwardedFor = nextIp();
      const res = await tryLogin(target, `wrong-${i}-password`);
      if ("error" in res! && res.error === "tooMany") blocked++;
    }
    expect(blocked).toBeGreaterThanOrEqual(5); // 15 attempts allowed per account per window
  });

  it("does not punish a legitimate user who signs in after a few typos", async () => {
    forwardedFor = nextIp();
    expect(await tryLogin(emails.admin, "typo-one-password")).toEqual({ error: "invalid" });
    expect(await tryLogin(emails.admin, password)).toEqual({ redirect: "/en/admin" });
  });
});
