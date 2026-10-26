import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { can, canAccessAdmin, type Action, type Resource } from "./rbac";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { SESSION_COOKIE } from "./session";
import { resolveSession } from "./session-store";

export type CurrentUser = { id: string; email: string; fullName: string; role: string };

/** Resolves the signed-in user from the session cookie, re-checking the DB so deactivation takes effect at once. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection(); // session expiry depends on the current time, so never prerender this
  return resolveSession((await cookies()).get(SESSION_COOKIE)?.value);
});

/** Server-side permission gate: redirects guests, and throws for signed-in users lacking the right. */
export async function requirePermission(lang: string, resource: Resource, action: Action): Promise<CurrentUser> {
  const user = await requireAdmin(lang);
  if (!can(user.role, resource, action)) throw new Error("FORBIDDEN");
  return user;
}

export async function requireAdmin(rawLang: string): Promise<CurrentUser> {
  // The language can come from a server-action argument, so never put it into a URL unchecked.
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/admin/login`);
  if (!canAccessAdmin(user.role)) redirect(`/${lang}/admin/login?error=forbidden`);
  return user;
}
