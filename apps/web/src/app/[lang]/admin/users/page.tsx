import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, isRoleKey, roleKeys } from "@/lib/rbac";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { Pager } from "@/components/pager";
import { inputClass } from "@/components/admin-ui";
import { Select } from "@/components/form-controls";
import { AdminLoading } from "@/components/loading-states";

const PAGE_SIZE = 25;

export default function UsersAdmin({ searchParams }: PageProps<"/[lang]/admin/users">) {
  return (
    <Suspense fallback={<AdminLoading kind="table" filters />}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/[lang]/admin/users">["searchParams"] }) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const [user, dict] = await Promise.all([requirePermission(locale, "user", "view"), getDictionary()]);
  const t = dict.admin.users;
  const first = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const q = first("q").trim().slice(0, 100);
  const role = isRoleKey(first("role")) ? first("role") : "";
  const state = first("state") === "active" || first("state") === "inactive" ? first("state") : "";
  const page = Math.max(1, Math.floor(Number(first("page"))) || 1);

  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    ...(role ? { role: { key: role } } : {}),
    ...(state ? { isActive: state === "active" } : {}),
  };
  const total = await db.user.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const users = await db.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, email: true, fullName: true, isActive: true, createdAt: true, role: { select: { key: true } } },
  });

  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (role) s.set("role", role);
    if (state) s.set("state", state);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return `/${locale}/admin/users${qs ? `?${qs}` : ""}`;
  };
  const tag = htmlLang[locale];

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="users" title={t.title}>
      {can(user.role, "user", "create") && (
        <Link href={`/${locale}/admin/users/new`} className="inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg">
          {t.new}
        </Link>
      )}

      <form method="get" className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="us-q" className="mb-1 block text-sm font-medium">{t.search}</label>
          <input id="us-q" name="q" defaultValue={q} maxLength={100} className={inputClass} />
        </div>
        <div>
          <label htmlFor="us-role" className="mb-1 block text-sm font-medium">{t.role}</label>
          <Select id="us-role" name="role" defaultValue={role}>
            <option value="">{t.all}</option>
            {roleKeys.map((k) => (
              <option key={k} value={k}>{dict.admin.roles.names[k]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="us-state" className="mb-1 block text-sm font-medium">{t.state}</label>
          <Select id="us-state" name="state" defaultValue={state}>
            <option value="">{t.all}</option>
            <option value="active">{t.active}</option>
            <option value="inactive">{t.inactive}</option>
          </Select>
        </div>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg">{t.apply}</button>
          <Link href={`/${locale}/admin/users`} className="text-sm font-medium text-brand underline underline-offset-4">{t.reset}</Link>
        </div>
      </form>

      {total === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.empty}</p>
      ) : (
        <>
          <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{t.fields.fullName}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.fields.email}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.role}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.state}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.created}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{dict.admin.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {u.fullName}
                      {u.id === user.id && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-normal">{t.you}</span>}
                    </td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{isRoleKey(u.role.key) ? dict.admin.roles.names[u.role.key] : u.role.key}</td>
                    <td className="px-4 py-3">{u.isActive ? t.active : t.inactive}</td>
                    <td className="px-4 py-3">{formatTashkent(u.createdAt, tag, false)}</td>
                    <td className="px-4 py-3">
                      {can(user.role, "user", "update") && (u.role.key !== "SUPER_ADMIN" || user.role === "SUPER_ADMIN") && (
                        <Link href={`/${locale}/admin/users/${u.id}`} className="font-medium text-brand underline underline-offset-4">
                          {dict.admin.common.edit}
                          <span className="sr-only"> {u.fullName}</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={current} pages={pages} total={total} hrefFor={href} labels={t.pager} ariaLabel={dict.nav.pagination} />
        </>
      )}
    </AdminShell>
  );
}
