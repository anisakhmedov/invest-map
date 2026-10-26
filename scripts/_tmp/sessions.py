root = "D:/WORK/InvestMap/apps/web/"


def edit(path, pairs):
    p = root + path
    s = open(p, encoding="utf8").read()
    for a, b in pairs:
        assert a in s, (path, a[:70])
        s = s.replace(a, b, 1)
    open(p, "w", encoding="utf8").write(s)


# ---- schema ----
edit("prisma/schema.prisma", [
    ("  auditLogs        AuditLog[]\n", "  auditLogs        AuditLog[]\n  sessions         Session[]\n"),
])
s = open(root + "prisma/schema.prisma", encoding="utf8").read()
s += '''
// One row per sign-in. The session cookie is only valid while its row exists, so a stolen or old
// cookie can be cancelled on the server (sign-out, account deactivation, "sign out everywhere").
model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@index([userId])
  @@index([expiresAt])
}
'''
open(root + "prisma/schema.prisma", "w", encoding="utf8").write(s)

# ---- token carries the session id ----
edit("src/lib/session.ts", [
    ("export type SessionPayload = { sub: string; role: string; exp: number };", "export type SessionPayload = { sub: string; sid: string; role: string; exp: number };"),
    ("  user: { id: string; role: string },", "  user: { id: string; role: string; sessionId: string },"),
    ("    sub: user.id,\n    role: user.role,", "    sub: user.id,\n    sid: user.sessionId,\n    role: user.role,"),
    ('if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;', 'if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.role !== "string") return null;'),
])

# ---- getCurrentUser uses the session table ----
edit("src/lib/auth.ts", [
    ('import { SESSION_COOKIE, verifySessionToken } from "./session";', 'import { SESSION_COOKIE } from "./session";\nimport { resolveSession } from "./session-store";'),
    ('''  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, fullName: true, isActive: true, role: { select: { key: true } } },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role.key };
});''', '''  return resolveSession((await cookies()).get(SESSION_COOKIE)?.value);
});'''),
    ('import { db } from "./db";\n', ""),
])

# ---- login and logout ----
edit("src/app/[lang]/admin/actions.ts", [
    ('import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";', 'import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";\nimport { revokeSession, startSession } from "@/lib/session-store";'),
    ('  (await cookies()).set(SESSION_COOKIE, createSessionToken({ id: user.id, role: user.role.key }), sessionCookieOptions);',
     '  const session = await startSession(user.id, { ip, userAgent: (await headers()).get("user-agent") });\n  (await cookies()).set(SESSION_COOKIE, createSessionToken({ id: user.id, role: user.role.key, sessionId: session.id }), sessionCookieOptions);'),
    ('''  (await cookies()).delete(SESSION_COOKIE);
  redirect(`/${locale}/admin/login`);''', '''  const jar = await cookies();
  // Cancel the session on the server too, so a copied cookie stops working at once.
  const userId = await revokeSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  if (userId) {
    await db.auditLog.create({ data: buildAuditEntry({ userId, action: "auth.logout", entity: "User", entityId: userId, ip: await clientIp() }) });
  }
  redirect(`/${locale}/admin/login`);'''),
])

# ---- existing unit tests need the new field ----
p = root + "src/lib/lib.test.ts"
s = open(p, encoding="utf8").read()
s = s.replace('const user = { id: "u1", role: "ADMIN" };', 'const user = { id: "u1", role: "ADMIN", sessionId: "s1" };')
s = s.replace('toMatchObject({ sub: "u1", role: "ADMIN" })', 'toMatchObject({ sub: "u1", sid: "s1", role: "ADMIN" })')
s = s.replace('JSON.stringify({ sub: "u1", role: "SUPER_ADMIN", exp: 9_999_999_999 })', 'JSON.stringify({ sub: "u1", sid: "s1", role: "SUPER_ADMIN", exp: 9_999_999_999 })')
open(p, "w", encoding="utf8").write(s)
print("ok")
