import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { pickLocalized } from "@/lib/content";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { removeAuction } from "../invest-actions";
import { AdminLoading } from "@/components/loading-states";

export default function AuctionAdmin() {
  return (
    <Suspense fallback={<AdminLoading kind="table" />}>
      <List />
    </Suspense>
  );
}

async function List() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "auction", "view"), getDictionary()]);
  const t = dict.admin.auction;
  const lots = await db.auction.findMany({ orderBy: { startsAt: "desc" }, take: 500, include: { object: { select: { name: true, slug: true } } } });
  const nf = new Intl.NumberFormat(htmlLang[locale]);

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="auction" title={t.title}>
      {can(user.role, "auction", "create") && (
        <Link href={`/${locale}/admin/auction/new`} className="inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg">
          {t.new}
        </Link>
      )}

      {lots.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.empty}</p>
      ) : (
        <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t.columns.object}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.columns.period}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.columns.startPrice}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.columns.finalPrice}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.fields.status}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.fields.publish}</th>
                <th scope="col" className="px-3 py-2 font-medium">{dict.admin.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-medium">{pickLocalized(a.object.name, locale).text || a.object.slug}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatTashkent(a.startsAt, htmlLang[locale])}
                    <br />
                    <span className="text-muted">→ {formatTashkent(a.endsAt, htmlLang[locale])}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">${nf.format(a.startPriceUsd)}</td>
                  <td className="px-3 py-2 tabular-nums">{a.finalPriceUsd === null ? "—" : `$${nf.format(a.finalPriceUsd)}`}</td>
                  <td className="px-3 py-2">{t.statuses[a.status]}</td>
                  <td className="px-3 py-2">{a.publish === "PUBLISHED" ? dict.admin.common.published : dict.admin.common.draft}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {can(user.role, "auction", "update") && (
                        <Link href={`/${locale}/admin/auction/${a.id}`} className="font-medium text-brand underline underline-offset-4">
                          {dict.admin.common.edit}
                        </Link>
                      )}
                      {can(user.role, "auction", "delete") && (
                        <form action={removeAuction.bind(null, locale, a.id)}>
                          <ConfirmButton message={dict.admin.common.confirmDelete} className="text-red-600 underline underline-offset-4 dark:text-red-400">
                            {dict.admin.common.delete}
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
