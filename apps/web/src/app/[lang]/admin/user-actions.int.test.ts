import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { hashPassword, verifyPassword } from "@/lib/password";
import { startSession, resolveSession } from "@/lib/session-store";
import { createSessionToken } from "@/lib/session";

let actor = { id: "", role: "ADMIN" };

vi.mock("@/lib/auth", () => ({
  requirePermission: async (_lang: string, resource: never, action: never) => {
    if (!can(actor.role, resource, action)) throw new Error("FORBIDDEN");
    return { id: actor.id, email: "actor@example.test", fullName: "Actor", role: actor.role };
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "198.51.100.200" }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, updateTag: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { saveUser } = await import("./user-actions");

const tag = `uit${Date.now()}`;
const startedAt = new Date();
const email = (n: string) => `${tag}.${n}@example.test`;
const password = "Correct-horse-123";
const ids: Record<string, string> = {};

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
const fields = (n: string, role: string, extra: Record<string, string> = {}) => ({
  email: email(n),
  fullName: `${tag} ${n}`,
  locale: "ru",
  role,
  isActive: "on",
  ...extra,
});

async function run(id: string | null, values: Record<string, string>) {
  try {
    return await saveUser("en", id, undefined, form(values));
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return { redirect: m[1] };
    throw e;
  }
}

beforeAll(async () => {
  const roles = Object.fromEntries((await db.role.findMany()).map((r) => [r.key, r.id]));
  const passwordHash = await hashPassword(password);
  const make = (n: string, role: string) => db.user.create({ data: { email: email(n), passwordHash, fullName: `${tag} ${n}`, roleId: roles[role] } });
  const [admin, editor, sa] = await Promise.all([make("admin", "ADMIN"), make("editor", "CONTENT_EDITOR"), make("sa", "SUPER_ADMIN")]);
  ids.admin = admin.id;
  ids.editor = editor.id;
  ids.sa = sa.id;
  actor = { id: admin.id, role: "ADMIN" };
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, OR: [{ ip: "198.51.100.200" }, { user: { fullName: { startsWith: tag } } }] } });
  await db.user.deleteMany({ where: { fullName: { startsWith: tag } } });
  await db.$disconnect();
});

describe("saveUser", () => {
  it("creates an account with a hashed password, audits it without secrets and redirects to it", async () => {
    const res = await run(null, { ...fields("new", "CONTENT_EDITOR"), password });
    expect(res).toMatchObject({ redirect: expect.stringMatching(/^\/en\/admin\/users\//) });
    const created = await db.user.findUniqueOrThrow({ where: { email: email("new") }, include: { role: true } });
    ids.new = created.id;
    expect(created.role.key).toBe("CONTENT_EDITOR");
    expect(created.passwordHash).not.toContain(password);
    expect(await verifyPassword(password, created.passwordHash)).toBe(true);

    const log = await db.auditLog.findFirstOrThrow({ where: { action: "user.create", entityId: created.id } });
    expect(JSON.stringify(log)).not.toContain(password);
    expect(JSON.stringify(log)).not.toContain(created.passwordHash);
    expect(log.userId).toBe(ids.admin);
  });

  it("refuses weak passwords, duplicate emails and bad input", async () => {
    expect(await run(null, { ...fields("weak", "ADMIN"), password: "short1" })).toEqual({ error: "weakPassword" });
    expect(await run(null, { ...fields("editor", "ADMIN"), password })).toEqual({ error: "emailTaken" });
    expect(await run(null, { ...fields("bad", "ADMIN"), email: "nope", password })).toEqual({ error: "invalid" });
    expect(await run(null, { ...fields("bad", "ROOT"), password })).toEqual({ error: "invalid" });
    expect(await db.user.count({ where: { email: { in: [email("weak"), email("bad")] } } })).toBe(0);
  });

  it("stops an admin from creating, promoting to, or editing a super admin", async () => {
    expect(await run(null, { ...fields("esc", "SUPER_ADMIN"), password })).toEqual({ error: "forbiddenRole" });
    expect(await run(ids.editor, fields("editor", "SUPER_ADMIN"))).toEqual({ error: "forbiddenRole" });
    expect(await run(ids.sa, fields("sa", "ADMIN"))).toEqual({ error: "forbiddenRole" });
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.sa }, include: { role: true } })).role.key).toBe("SUPER_ADMIN");
  });

  it("does not let people without the right in", async () => {
    actor = { id: ids.editor, role: "CONTENT_EDITOR" };
    await expect(run(null, { ...fields("nope", "ADMIN"), password })).rejects.toThrow("FORBIDDEN");
    actor = { id: ids.admin, role: "ADMIN" };
  });

  it("does not let you lock yourself out", async () => {
    expect(await run(ids.admin, { ...fields("admin", "ADMIN"), isActive: "" })).toEqual({ error: "selfLockout" });
    expect(await run(ids.admin, fields("admin", "CONTENT_EDITOR"))).toEqual({ error: "selfLockout" });
  });

  it("lets a super admin change another super admin while one remains", async () => {
    actor = { id: ids.new, role: "SUPER_ADMIN" };
    expect(await run(ids.sa, fields("sa", "ADMIN"))).toEqual({ saved: true });
    actor = { id: ids.admin, role: "ADMIN" };
  });

  it("signs the person out everywhere when role, status or password change", async () => {
    const token = async () => {
      const session = await startSession(ids.editor);
      return createSessionToken({ id: ids.editor, role: "CONTENT_EDITOR", sessionId: session.id });
    };
    let t = await token();
    expect(await resolveSession(t)).not.toBeNull();
    expect(await run(ids.editor, fields("editor", "MAP_EDITOR"))).toEqual({ saved: true });
    expect(await resolveSession(t)).toBeNull();

    t = await token();
    expect(await run(ids.editor, { ...fields("editor", "MAP_EDITOR"), password: "Another-pass-456" })).toEqual({ saved: true });
    expect(await resolveSession(t)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "user.password_reset", entityId: ids.editor } })).toBe(1);

    t = await token();
    expect(await run(ids.editor, { ...fields("editor", "MAP_EDITOR"), isActive: "" })).toEqual({ saved: true });
    expect(await resolveSession(t)).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: ids.editor } })).isActive).toBe(false);
  });

  it("leaves everything else alone when a plain edit is saved", async () => {
    const t0 = await db.user.findUniqueOrThrow({ where: { id: ids.new } });
    expect(await run(ids.new, { ...fields("new", "CONTENT_EDITOR"), fullName: `${tag} renamed` })).toEqual({ saved: true });
    const t1 = await db.user.findUniqueOrThrow({ where: { id: ids.new } });
    expect(t1.fullName).toBe(`${tag} renamed`);
    expect(t1.passwordHash).toBe(t0.passwordHash);
  });
});
