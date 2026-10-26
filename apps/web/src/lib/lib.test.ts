import { describe, expect, it } from "vitest";
import { actions, can, canAccessAdmin, defaultPermissions, resources, roleKeys } from "./rbac";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";
import { SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from "./session";
import { createRateLimiter } from "./rate-limit";
import { clientIpFrom } from "./client-ip";
import { buildAuditEntry, redact } from "./audit";

const SECRET = "test-secret-at-least-16-chars";

describe("rbac", () => {
  it("SUPER_ADMIN can do everything", () => {
    for (const r of resources) for (const a of actions) expect(can("SUPER_ADMIN", r, a)).toBe(true);
  });

  it("unknown roles can do nothing", () => {
    expect(can("HACKER", "page", "view")).toBe(false);
    expect(can("", "page", "view")).toBe(false);
    expect(canAccessAdmin("HACKER")).toBe(false);
  });

  it("only SUPER_ADMIN manages roles", () => {
    for (const role of roleKeys.filter((r) => r !== "SUPER_ADMIN")) {
      for (const a of actions) expect(can(role, "role", a)).toBe(false);
    }
  });

  it("content editor edits pages but not users or map", () => {
    expect(can("CONTENT_EDITOR", "page", "publish")).toBe(true);
    expect(can("CONTENT_EDITOR", "user", "view")).toBe(false);
    expect(can("CONTENT_EDITOR", "map.layer", "update")).toBe(false);
  });

  it("map editor edits map but cannot delete invest data", () => {
    expect(can("MAP_EDITOR", "map.feature", "delete")).toBe(true);
    expect(can("MAP_EDITOR", "invest", "delete")).toBe(false);
  });

  it("investor can create and view requests only", () => {
    expect(can("INVESTOR", "request", "create")).toBe(true);
    expect(can("INVESTOR", "request", "delete")).toBe(false);
    expect(can("INVESTOR", "page", "view")).toBe(false);
  });

  it("investor has no admin access, staff do", () => {
    expect(canAccessAdmin("INVESTOR")).toBe(false);
    for (const r of roleKeys.filter((x) => x !== "INVESTOR")) expect(canAccessAdmin(r)).toBe(true);
  });

  it("matrix references only known resources and actions", () => {
    for (const role of roleKeys) {
      for (const [res, acts] of Object.entries(defaultPermissions[role])) {
        expect(resources as readonly string[]).toContain(res);
        for (const a of acts ?? []) expect(actions as readonly string[]).toContain(a);
      }
    }
  });
});

describe("password", () => {
  it("verifies the correct password and rejects wrong ones", async () => {
    const hash = await hashPassword("Correct-horse-9");
    expect(await verifyPassword("Correct-horse-9", hash)).toBe(true);
    expect(await verifyPassword("correct-horse-9", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("uses a unique salt per hash and never stores plaintext", async () => {
    const [a, b] = await Promise.all([hashPassword("Same-pass-123"), hashPassword("Same-pass-123")]);
    expect(a).not.toBe(b);
    expect(a).not.toContain("Same-pass-123");
  });

  it("rejects malformed hashes without throwing", async () => {
    for (const bad of ["", "plain", "scrypt$1$2$3", "bcrypt$a$b$c$d$e", "scrypt$1$8$1$AAAA$AAAA"]) {
      expect(await verifyPassword("x", bad)).toBe(false);
    }
  });

  it("validates password strength", () => {
    expect(validatePasswordStrength("short1")).toBe("too_short");
    expect(validatePasswordStrength("onlyletterslong")).toBe("needs_letter_and_digit");
    expect(validatePasswordStrength("1234567890123")).toBe("needs_letter_and_digit");
    expect(validatePasswordStrength("Valid-pass-123")).toBeNull();
  });
});

describe("session tokens", () => {
  const user = { id: "u1", role: "ADMIN", sessionId: "s1" };

  it("round-trips a valid token", () => {
    const token = createSessionToken(user, SECRET, 1_000_000);
    expect(verifySessionToken(token, SECRET, 1_000_000)).toMatchObject({ sub: "u1", sid: "s1", role: "ADMIN" });
  });

  it("expires after the TTL", () => {
    const token = createSessionToken(user, SECRET, 0);
    expect(verifySessionToken(token, SECRET, (SESSION_TTL_SECONDS - 1) * 1000)).not.toBeNull();
    expect(verifySessionToken(token, SECRET, SESSION_TTL_SECONDS * 1000)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken(user, SECRET);
    expect(verifySessionToken(token, "another-secret-16-chars!")).toBeNull();
  });

  it("rejects tampered payloads (role escalation)", () => {
    const token = createSessionToken(user, SECRET);
    const [, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "u1", sid: "s1", role: "SUPER_ADMIN", exp: 9_999_999_999 }),
    ).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects garbage input", () => {
    for (const bad of [undefined, "", "abc", "a.b.c", ".", "a."]) {
      expect(verifySessionToken(bad, SECRET)).toBeNull();
    }
  });

  it("refuses a weak or missing secret", () => {
    expect(() => createSessionToken(user, "short")).toThrow();
    expect(() => createSessionToken(user, undefined)).toThrow();
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    const rl = createRateLimiter(3, 1000);
    for (let i = 0; i < 3; i++) expect(rl.check("ip", 0).allowed).toBe(true);
    const blocked = rl.check("ip", 100);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(900);
    expect(rl.check("ip", 1000).allowed).toBe(true);
  });

  it("tracks keys independently and supports reset", () => {
    const rl = createRateLimiter(1, 1000);
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("a", 1).allowed).toBe(false);
    expect(rl.check("b", 1).allowed).toBe(true);
    rl.reset("a");
    expect(rl.check("a", 2).allowed).toBe(true);
  });
});

describe("rate limiter memory", () => {
  it("never grows past maxKeys and keeps recent entries", () => {
    const rl = createRateLimiter(1, 1000, 100);
    for (let i = 0; i < 1000; i++) rl.check(`k${i}`, 0);
    expect(rl.size()).toBeLessThanOrEqual(100);
    rl.check("fresh", 1);
    expect(rl.check("fresh", 2).allowed).toBe(false); // the newest key is still tracked
  });

  it("sweeps expired entries before evicting live ones", () => {
    const rl = createRateLimiter(1, 1000, 10);
    for (let i = 0; i < 10; i++) rl.check(`old${i}`, 0);
    rl.check("new", 5000); // all old entries expired by now
    expect(rl.size()).toBe(1);
  });
});

describe("clientIpFrom", () => {
  it("trusts the last hop, which our proxy appended, not the spoofable first one", () => {
    expect(clientIpFrom("6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIpFrom("203.0.113.9")).toBe("203.0.113.9");
  });

  it("normalizes IPv4-mapped addresses and accepts IPv6", () => {
    expect(clientIpFrom("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(clientIpFrom("2001:db8::1")).toBe("2001:db8::1");
  });

  it("falls back to a shared bucket for missing or junk values", () => {
    for (const v of [null, undefined, "", " ", "<script>", "1.2.3.4, evil host", "x".repeat(100)]) {
      expect(clientIpFrom(v as string | null)).toBe("unknown");
    }
  });
});

describe("audit", () => {
  it("redacts secrets recursively", () => {
    expect(redact({ email: "a@b.c", passwordHash: "x", nested: { token: "t", list: [{ secret: "s" }] } })).toEqual({
      email: "a@b.c",
      passwordHash: "[redacted]",
      nested: { token: "[redacted]", list: [{ secret: "[redacted]" }] },
    });
  });

  it("builds an entry with defaults and redacted snapshots", () => {
    const entry = buildAuditEntry({
      action: "user.update",
      entity: "User",
      before: { password: "old" },
      after: { password: "new", name: "X" },
    });
    expect(entry).toMatchObject({ userId: null, entityId: null, ip: null });
    expect(entry.before).toEqual({ password: "[redacted]" });
    expect(entry.after).toEqual({ password: "[redacted]", name: "X" });
  });

  it("redacts sensitive keys regardless of letter case", () => {
    expect(redact({ Password: "x", passwordHash: "y", PASSWORDHASH: "z", Token: "t" })).toEqual({
      Password: "[redacted]",
      passwordHash: "[redacted]",
      PASSWORDHASH: "[redacted]",
      Token: "[redacted]",
    });
  });

  it("keeps Date values intact", () => {
    const d = new Date(0);
    expect(redact({ at: d })).toEqual({ at: d });
  });
});
