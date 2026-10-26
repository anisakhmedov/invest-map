import { z } from "zod";
import { locales } from "@/i18n/config";
import { roleKeys, type RoleKey } from "@/lib/rbac";
import { validatePasswordStrength } from "@/lib/password";

/** Only a super admin may create, edit or promote to super admin; everyone else could otherwise escalate their own rights. */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  return actorRole === "SUPER_ADMIN" || targetRole !== "SUPER_ADMIN";
}

export function assignableRoles(actorRole: string): readonly RoleKey[] {
  return roleKeys.filter((r) => canManageRole(actorRole, r));
}

/** True when the change would leave the site without an active super admin. */
export function removesLastSuperAdmin(args: {
  current: { role: string; isActive: boolean };
  next: { role: string; isActive: boolean };
  otherActiveSuperAdmins: number;
}): boolean {
  const wasSuper = args.current.role === "SUPER_ADMIN" && args.current.isActive;
  const staysSuper = args.next.role === "SUPER_ADMIN" && args.next.isActive;
  return wasSuper && !staysSuper && args.otherActiveSuperAdmins === 0;
}

const base = {
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  locale: z.enum(locales),
  role: z.enum(roleKeys),
  isActive: z.boolean(),
};

export const userCreateSchema = z.object({ ...base, password: z.string().max(200) });
export const userUpdateSchema = z.object({ ...base, password: z.string().max(200).optional() });

export type PasswordProblem = "too_short" | "needs_letter_and_digit";
export const checkPassword = (password: string): PasswordProblem | null => validatePasswordStrength(password) as PasswordProblem | null;
