p = "D:/WORK/InvestMap/apps/web/src/app/[lang]/admin/login.int.test.ts"
s = open(p, encoding="utf8").read()


def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)


rep('import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";', 'import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";\nimport { resolveSession } from "@/lib/session-store";')
rep('''    expect(session?.sub).toBe(user.id);
    expect(await db.auditLog.count({ where: { userId: user.id, action: "auth.login" } })).toBe(1);''', '''    expect(session?.sub).toBe(user.id);
    expect(await db.auditLog.count({ where: { userId: user.id, action: "auth.login" } })).toBe(1);
    // the cookie is backed by a server-side session row
    const row = await db.session.findUniqueOrThrow({ where: { id: session!.sid } });
    expect(row).toMatchObject({ userId: user.id, ip: forwardedFor });
    expect((await resolveSession(cookieJar.get(SESSION_COOKIE)))?.id).toBe(user.id);''')
rep('''  it("logout clears the cookie and goes to the login page", async () => {
    cookieJar.set(SESSION_COOKIE, "something");
    await expect(logout("ru")).rejects.toThrow("REDIRECT:/ru/admin/login");
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
    await expect(logout("//evil.example")).rejects.toThrow("REDIRECT:/uz/admin/login");
  });''', '''  it("logout clears the cookie, cancels the session on the server and goes to the login page", async () => {
    expect(await tryLogin(emails.admin, password)).toEqual({ redirect: "/en/admin" });
    const stolen = cookieJar.get(SESSION_COOKIE)!; // someone copied the cookie before sign-out
    expect(await resolveSession(stolen)).not.toBeNull();

    await expect(logout("ru")).rejects.toThrow("REDIRECT:/ru/admin/login");
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
    expect(await resolveSession(stolen)).toBeNull(); // the copied cookie is dead too
    const user = await db.user.findUniqueOrThrow({ where: { email: emails.admin } });
    expect(await db.auditLog.count({ where: { userId: user.id, action: "auth.logout" } })).toBeGreaterThanOrEqual(1);

    await expect(logout("//evil.example")).rejects.toThrow("REDIRECT:/uz/admin/login"); // no cookie: still safe
  });''')
open(p, "w", encoding="utf8").write(s)
print("ok")
