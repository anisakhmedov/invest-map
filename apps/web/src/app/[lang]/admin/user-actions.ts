"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { buildAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { clientIpFrom } from "@/lib/client-ip";
import { hashPassword } from "@/lib/password";
import { revokeAllSessions } from "@/lib/session-store";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { canManageRole, checkPassword, removesLastSuperAdmin, userCreateSchema, userUpdateSchema } from "@/features/users/policy";

export type UserFormState = { error?: string; saved?: boolean } | undefined;

const loc = (lang: string) => (hasLocale(lang) ? lang : defaultLocale);

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

/** What the audit log keeps about an account: never the password hash. */
const snapshot = (u: { email: string; fullName: string; locale: string; isActive: boolean; role: { key: string } }) => ({
  email: u.email,
  fullName: u.fullName,
  locale: u.locale,
  isActive: u.isActive,
  role: u.role.key,
});

/** Creates (id = null) or updates an account. Rights are checked here, not in the form. */
export async function saveUser(lang: string, id: string | null, _prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const actor = await requirePermission(lang, "user", id ? "update" : "create");

  const raw = {
    email: text(formData, "email"),
    fullName: text(formData, "fullName"),
    locale: text(formData, "locale"),
    role: text(formData, "role"),
    isActive: id ? formData.get("isActive") === "on" : true,
    password: text(formData, "password"),
  };
  const parsed = id ? userUpdateSchema.safeParse({ ...raw, password: raw.password || undefined }) : userCreateSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;

  if (!canManageRole(actor.role, input.role)) return { error: "forbiddenRole" };
  if (input.password !== undefined) {
    if (checkPassword(input.password)) return { error: "weakPassword" };
  }

  const before = id ? await db.user.findUnique({ where: { id }, include: { role: true } }) : null;
  if (id && !before) return { error: "notFound" };
  if (before && !canManageRole(actor.role, before.role.key)) return { error: "forbiddenRole" };

  if (before) {
    if (before.id === actor.id && (input.role !== before.role.key || !input.isActive)) return { error: "selfLockout" };
    const others = await db.user.count({ where: { id: { not: before.id }, isActive: true, role: { key: "SUPER_ADMIN" } } });
    if (removesLastSuperAdmin({ current: { role: before.role.key, isActive: before.isActive }, next: { role: input.role, isActive: input.isActive }, otherActiveSuperAdmins: others })) {
      return { error: "lastSuperAdmin" };
    }
  }

  const role = await db.role.findUnique({ where: { key: input.role } });
  if (!role) return { error: "invalid" };
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  let savedId: string;
  try {
    const data = { email: input.email, fullName: input.fullName, locale: input.locale, isActive: input.isActive, roleId: role.id };
    const saved = before
      ? await db.user.update({ where: { id: before.id }, data: { ...data, ...(passwordHash ? { passwordHash } : {}) }, include: { role: true } })
      : await db.user.create({ data: { ...data, passwordHash: passwordHash! }, include: { role: true } });
    savedId = saved.id;

    const ip = clientIpFrom((await headers()).get("x-forwarded-for"));
    const entries = [
      buildAuditEntry({
        userId: actor.id,
        action: before ? "user.update" : "user.create",
        entity: "User",
        entityId: saved.id,
        before: before ? snapshot(before) : undefined,
        after: snapshot(saved),
        ip,
      }),
    ];
    if (before && passwordHash) {
      entries.push(buildAuditEntry({ userId: actor.id, action: "user.password_reset", entity: "User", entityId: saved.id, ip }));
    }
    await db.auditLog.createMany({ data: entries });

    // Rights, state or password changed: whoever is signed in with the old ones must sign in again.
    if (before && (passwordHash || !saved.isActive || saved.role.key !== before.role.key)) await revokeAllSessions(saved.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "emailTaken" };
    throw e;
  }

  revalidatePath(`/${loc(lang)}/admin/users`);
  if (!id) redirect(`/${loc(lang)}/admin/users/${savedId}`);
  return { saved: true };
}
