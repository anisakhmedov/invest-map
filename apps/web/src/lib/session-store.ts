import { db } from "./db";
import { SESSION_TTL_SECONDS, verifySessionToken } from "./session";

export type SessionUser = { id: string; email: string; fullName: string; role: string };

/**
 * A signed cookie alone cannot be cancelled, so every sign-in also gets a row here. The cookie is only
 * accepted while its row exists, which makes sign-out, "sign out everywhere" and account removal immediate.
 */
export async function startSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
  now = new Date(),
): Promise<{ id: string; expiresAt: Date }> {
  await db.session.deleteMany({ where: { userId, expiresAt: { lt: now } } }); // tidy up as we go
  return db.session.create({
    data: {
      userId,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ? meta.userAgent.slice(0, 200) : null,
      expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
    },
    select: { id: true, expiresAt: true },
  });
}

/** Returns the signed-in user for a cookie value, or null if it is forged, expired, revoked or the account is off. */
export async function resolveSession(token: string | undefined, now = new Date()): Promise<SessionUser | null> {
  const payload = verifySessionToken(token, undefined, now.getTime());
  if (!payload) return null;

  const row = await db.session.findUnique({
    where: { id: payload.sid },
    select: {
      userId: true,
      expiresAt: true,
      user: { select: { id: true, email: true, fullName: true, isActive: true, role: { select: { key: true } } } },
    },
  });
  if (!row || row.userId !== payload.sub || row.expiresAt <= now || !row.user.isActive) return null;
  // The role comes from the database, not from the cookie, so role changes apply immediately.
  return { id: row.user.id, email: row.user.email, fullName: row.user.fullName, role: row.user.role.key };
}

export async function revokeSession(token: string | undefined): Promise<string | null> {
  const payload = verifySessionToken(token);
  if (!payload) return null;
  await db.session.deleteMany({ where: { id: payload.sid, userId: payload.sub } });
  return payload.sub;
}

export async function revokeAllSessions(userId: string): Promise<number> {
  return (await db.session.deleteMany({ where: { userId } })).count;
}
