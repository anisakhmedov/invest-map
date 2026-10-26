import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { pickLocalized } from "@/lib/content";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { deletePage } from "../cms-actions";
import { AdminLoading } from "@/components/loading-states";

export default function PagesAdmin() {
  return (
    <Suspense fallback={<AdminLoading kind="table" />}>
      <List />
    </Suspense>
  );
}

async function List() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "page", "view"), getDictionary()]);
  const pages = await db.page.findMany({ orderBy: { updatedAt: "desc" } });
  const t = dict.admin;

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="pages" title={t.pages.title}>
      {can(user.role, "page", "create") && (
        <Link
          href={`/${locale}/admin/pages/new`}
          className="inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg"
        >
          {t.pages.new}
        </Link>
      )}

      {pages.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.pages.empty}</p>
      ) : (
        <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t.pages.titleField}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t.common.kind}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t.common.status}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{pickLocalized(p.title, locale).text || p.slug}</div>
                    <div className="text-muted">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">{p.kind === "NEWS" ? t.common.kindNews : t.common.kindPage}</td>
                  <td className="px-4 py-3">{p.status === "PUBLISHED" ? t.common.published : t.common.draft}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {can(user.role, "page", "update") && (
                        <Link href={`/${locale}/admin/pages/${p.id}`} className="font-medium text-brand underline underline-offset-4">
                          {t.common.edit}
                        </Link>
                      )}
                      {can(user.role, "page", "delete") && (
                        <form action={deletePage.bind(null, locale, p.id)}>
                          <ConfirmButton
                            message={t.common.confirmDelete}
                            className="text-red-600 underline underline-offset-4 dark:text-red-400"
                          >
                            {t.common.delete}
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
