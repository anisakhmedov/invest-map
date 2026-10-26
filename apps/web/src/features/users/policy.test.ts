import { describe, expect, it } from "vitest";
import { assignableRoles, canManageRole, checkPassword, removesLastSuperAdmin, userCreateSchema, userUpdateSchema } from "./policy";

describe("role management", () => {
  it("lets only a super admin touch super admins", () => {
    expect(canManageRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(canManageRole("ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(canManageRole("ADMIN", "CONTENT_EDITOR")).toBe(true);
  });

  it("does not offer the super admin role to an admin", () => {
    expect(assignableRoles("ADMIN")).not.toContain("SUPER_ADMIN");
    expect(assignableRoles("ADMIN")).toContain("INVESTOR");
    expect(assignableRoles("SUPER_ADMIN")).toContain("SUPER_ADMIN");
  });
});

describe("removesLastSuperAdmin", () => {
  const sa = { role: "SUPER_ADMIN", isActive: true };
  it("blocks demoting or deactivating the only active super admin", () => {
    expect(removesLastSuperAdmin({ current: sa, next: { role: "ADMIN", isActive: true }, otherActiveSuperAdmins: 0 })).toBe(true);
    expect(removesLastSuperAdmin({ current: sa, next: { ...sa, isActive: false }, otherActiveSuperAdmins: 0 })).toBe(true);
  });
  it("allows it when another one remains, or when nothing changes", () => {
    expect(removesLastSuperAdmin({ current: sa, next: { role: "ADMIN", isActive: true }, otherActiveSuperAdmins: 1 })).toBe(false);
    expect(removesLastSuperAdmin({ current: sa, next: sa, otherActiveSuperAdmins: 0 })).toBe(false);
  });
  it("does not care about users who are not active super admins", () => {
    expect(removesLastSuperAdmin({ current: { role: "ADMIN", isActive: true }, next: { role: "INVESTOR", isActive: false }, otherActiveSuperAdmins: 0 })).toBe(false);
  });
});

describe("user input", () => {
  const ok = { email: " Person@Example.TEST ", fullName: "Person Name", locale: "ru", role: "ADMIN", isActive: true };

  it("normalizes the email", () => {
    expect(userCreateSchema.parse({ ...ok, password: "x" }).email).toBe("person@example.test");
  });
  it("rejects unknown roles, languages and bad emails", () => {
    expect(userUpdateSchema.safeParse({ ...ok, role: "ROOT" }).success).toBe(false);
    expect(userUpdateSchema.safeParse({ ...ok, locale: "de" }).success).toBe(false);
    expect(userUpdateSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
  });
  it("makes the password optional only when editing", () => {
    expect(userUpdateSchema.safeParse(ok).success).toBe(true);
    expect(userCreateSchema.safeParse(ok).success).toBe(false);
  });
  it("checks password strength", () => {
    expect(checkPassword("short1")).toBe("too_short");
    expect(checkPassword("onlyletterslong")).toBe("needs_letter_and_digit");
    expect(checkPassword("Correct-horse-123")).toBeNull();
  });
});
