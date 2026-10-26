"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasLocale, defaultLocale } from "@/i18n/config";
import { verifyPassword } from "@/lib/password";
import { createRateLimiter } from "@/lib/rate-limit";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { revokeSession, startSession } from "@/lib/session-store";
import { buildAuditEntry } from "@/lib/audit";
import { clientIpFrom } from "@/lib/client-ip";
import { canAccessAdmin } from "@/lib/rbac";

export type LoginState = { error?: "invalid" | "tooMany" | "forbidden" } | undefined;

const WINDOW = 15 * 60 * 1000;
// Three independent counters: one pair, one address, one account. The account counter stops
// guessing spread over many addresses; the address counter stops one machine trying many accounts.
const pairLimiter = createRateLimiter(5, WINDOW);
const ipLimiter = createRateLimiter(30, WINDOW);
const emailLimiter = createRateLimiter(15, WINDOW);

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

// Verified against this when the user does not exist, so timing doesn't reveal valid emails
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

async function clientIp() {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

export async function login(lang: string, _prev: LoginState, formData: FormData): Promise<LoginState> {
  const locale = hasLocale(lang) ? lang : defaultLocale;
  const ip = await clientIp();

  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "invalid" };
  const { email, password } = parsed.data;

  const key = `${ip}:${email}`;
  const allowed = [pairLimiter.check(key), ipLimiter.check(ip), emailLimiter.check(email)].every((r) => r.allowed);
  if (!allowed) return { error: "tooMany" };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isActive: true, role: { select: { key: true } } },
  });

  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !ok) {
    await db.auditLog.create({
      data: buildAuditEntry({ action: "auth.login_failed", entity: "User", after: { email }, ip }),
    });
    return { error: "invalid" };
  }
  if (!canAccessAdmin(user.role.key)) return { error: "forbidden" };

  pairLimiter.reset(key);
  emailLimiter.reset(email);
  const session = await startSession(user.id, { ip, userAgent: (await headers()).get("user-agent") });
  (await cookies()).set(SESSION_COOKIE, createSessionToken({ id: user.id, role: user.role.key, sessionId: session.id }), sessionCookieOptions);
  await db.auditLog.create({
    data: buildAuditEntry({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id, ip }),
  });
  redirect(`/${locale}/admin`);
}

export async function logout(lang: string) {
  const locale = hasLocale(lang) ? lang : defaultLocale;
  const jar = await cookies();
  // Cancel the session on the server too, so a copied cookie stops working at once.
  const userId = await revokeSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  if (userId) {
    await db.auditLog.create({ data: buildAuditEntry({ userId, action: "auth.logout", entity: "User", entityId: userId, ip: await clientIp() }) });
  }
  redirect(`/${locale}/admin/login`);
}
