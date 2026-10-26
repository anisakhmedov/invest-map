import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { hashPassword } from "./password";
import { createSessionToken } from "./session";
import { resolveSession, revokeAllSessions, revokeSession, startSession } from "./session-store";

const tag = `itsess${Date.now()}`;
let adminId = "";
let otherId = "";

const tokenFor = (userId: string, sessionId: string, role = "ADMIN", now?: number) => createSessionToken({ id: userId, role, sessionId }, undefined, now);

beforeAll(async () => {
  const roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.key, r.id]));
  const passwordHash = await hashPassword("Correct-horse-123");
  adminId = (await db.user.create({ data: { email: `${tag}.a@example.test`, passwordHash, fullName: tag, roleId: roles.ADMIN } })).id;
  otherId = (await db.user.create({ data: { email: `${tag}.b@example.test`, passwordHash, fullName: tag, roleId: roles.ADMIN } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { fullName: tag } }); // sessions go with them
  await db.$disconnect();
});

describe("server-side sessions", () => {
  it("accepts a cookie only while its session row exists", async () => {
    const s = await startSession(adminId, { ip: "198.51.100.5", userAgent: "TestAgent/1.0" });
    const token = tokenFor(adminId, s.id);
    expect(await resolveSession(token)).toMatchObject({ id: adminId, role: "ADMIN", fullName: tag });

    expect(await revokeSession(token)).toBe(adminId);
    expect(await resolveSession(token)).toBeNull(); // the signed cookie is still valid, but the session is gone
    expect(await db.session.findUnique({ where: { id: s.id } })).toBeNull();
  });

  it("stores the address and a trimmed user agent", async () => {
    const s = await startSession(adminId, { ip: "198.51.100.6", userAgent: "x".repeat(500) });
    const row = await db.session.findUniqueOrThrow({ where: { id: s.id } });
    expect(row.ip).toBe("198.51.100.6");
    expect(row.userAgent).toHaveLength(200);
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 7.9 * 3_600_000);
    await db.session.delete({ where: { id: s.id } });
  });

  it("rejects forged, mismatched and expired sessions", async () => {
    const mine = await startSession(adminId);
    // a valid signature for another user's id, pointing at my session
    expect(await resolveSession(tokenFor(otherId, mine.id))).toBeNull();
    expect(await resolveSession(tokenFor(adminId, "no-such-session"))).toBeNull();
    expect(await resolveSession(undefined)).toBeNull();
    expect(await resolveSession("garbage")).toBeNull();

    await db.session.update({ where: { id: mine.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resolveSession(tokenFor(adminId, mine.id))).toBeNull();
    // a cookie whose own expiry has passed is refused even if the row is still there
    const live = await startSession(adminId);
    expect(await resolveSession(tokenFor(adminId, live.id, "ADMIN", Date.now() - 9 * 3_600_000))).toBeNull();
    await revokeAllSessions(adminId);
  });

  it("stops working when the account is deactivated and picks up role changes at once", async () => {
    const s = await startSession(otherId);
    const token = tokenFor(otherId, s.id, "SUPER_ADMIN"); // the cookie claims a high role
    expect((await resolveSession(token))?.role).toBe("ADMIN"); // the database decides

    const editor = await db.role.findUniqueOrThrow({ where: { key: "CONTENT_EDITOR" } });
    await db.user.update({ where: { id: otherId }, data: { roleId: editor.id } });
    expect((await resolveSession(token))?.role).toBe("CONTENT_EDITOR");

    await db.user.update({ where: { id: otherId }, data: { isActive: false } });
    expect(await resolveSession(token)).toBeNull();
    await db.user.update({ where: { id: otherId }, data: { isActive: true } });
    expect(await resolveSession(token)).not.toBeNull();
  });

  it("signs a user out everywhere without touching other users", async () => {
    const a1 = await startSession(adminId);
    const a2 = await startSession(adminId);
    const b = await startSession(otherId);
    expect(await revokeAllSessions(adminId)).toBeGreaterThanOrEqual(2);
    expect(await resolveSession(tokenFor(adminId, a1.id))).toBeNull();
    expect(await resolveSession(tokenFor(adminId, a2.id))).toBeNull();
    expect(await resolveSession(tokenFor(otherId, b.id))).not.toBeNull();
  });

  it("removes expired rows of the same user when a new session starts", async () => {
    const old = await startSession(adminId);
    await db.session.update({ where: { id: old.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await startSession(adminId);
    expect(await db.session.findUnique({ where: { id: old.id } })).toBeNull();
  });

  it("deleting a user removes their sessions", async () => {
    const roles = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    const temp = await db.user.create({ data: { email: `${tag}.c@example.test`, passwordHash: "x", fullName: tag, roleId: roles.id } });
    const s = await startSession(temp.id);
    await db.user.delete({ where: { id: temp.id } });
    expect(await db.session.findUnique({ where: { id: s.id } })).toBeNull();
  });
});
