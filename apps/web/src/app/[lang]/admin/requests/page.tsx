import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { Pager } from "@/components/pager";
import { inputClass } from "@/components/admin-ui";
import {
  REQUEST_SORT_KEYS,
  applyRequestQuery,
  parseRequestQuery,
  serializeRequestQuery,
  type RequestQuery,
  type RequestRow,
} from "@/features/requests/admin-query";
import { REQUEST_STATUSES } from "@/features/requests/schemas";
import { isOverdue } from "@/features/requests/sla";
import { Select } from "@/components/form-controls";
import { AdminLoading } from "@/components/loading-states";

export default function RequestsAdmin({ searchParams }: PageProps<"/[lang]/admin/requests">) {
  return (
    <Suspense fallback={<AdminLoading kind="table" wide filters />}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/[lang]/admin/requests">["searchParams"] }) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const [user, dict] = await Promise.all([requirePermission(locale, "request", "view"), getDictionary()]);
  const t = dict.admin.requests;
  const first = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const query = parseRequestQuery({ get: first });

  const [requests, staff] = await Promise.all([
    db.request.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: { id: true, number: true, subject: true, contactName: true, contactEmail: true, status: true, assigneeId: true, dueAt: true, createdAt: true, assignee: { select: { fullName: true } } },
    }),
    db.user.findMany({ where: { isActive: true, role: { key: { in: ["SUPER_ADMIN", "ADMIN", "REQUEST_MANAGER"] } } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const rows: RequestRow[] = requests.map((r) => ({ ...r, assigneeName: r.assignee?.fullName ?? null }));
  const result = applyRequestQuery(rows, query, user.id);

  const tag = htmlLang[locale];
  const href = (over: Partial<RequestQuery>) => {
    const qs = serializeRequestQuery({ ...query, ...over });
    return `/${locale}/admin/requests${qs ? `?${qs}` : ""}`;
  };
  const head = (key: (typeof REQUEST_SORT_KEYS)[number], label: string) => {
    const active = query.sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (query.sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 py-2 font-medium">
        <Link href={href({ sort: { key, dir: active && query.sort.dir === "asc" ? "desc" : "asc" }, page: 1 })} className="hover:underline">
          {label}
          {active && <span aria-hidden> {query.sort.dir === "asc" ? "↑" : "↓"}</span>}
        </Link>
      </th>
    );
  };

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="requests" title={t.title} wide>
      <form method="get" className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="rq-q" className="mb-1 block text-sm font-medium">{t.filters.search}</label>
          <input id="rq-q" name="q" defaultValue={query.q} className={inputClass} />
        </div>
        <div>
          <label htmlFor="rq-status" className="mb-1 block text-sm font-medium">{t.columns.status}</label>
          <Select id="rq-status" name="status" defaultValue={query.status}>
            <option value="">{t.filters.all}</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>{t.statuses[s]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="rq-assignee" className="mb-1 block text-sm font-medium">{t.columns.assignee}</label>
          <Select id="rq-assignee" name="assignee" defaultValue={query.assignee}>
            <option value="">{t.filters.all}</option>
            <option value="me">{t.filters.me}</option>
            <option value="none">{t.filters.none}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="overdue" value="1" defaultChecked={query.overdue} />
          {t.filters.overdue}
        </label>
        <input type="hidden" name="sort" value={query.sort.dir === "desc" ? `-${query.sort.key}` : query.sort.key} />
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg">{t.filters.apply}</button>
          <Link href={`/${locale}/admin/requests`} className="text-sm font-medium text-brand underline underline-offset-4">{t.filters.reset}</Link>
        </div>
      </form>

      {result.total === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.empty}</p>
      ) : (
        <>
          <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  {head("number", "№")}
                  {head("subject", t.columns.subject)}
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.from}</th>
                  {head("status", t.columns.status)}
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.assignee}</th>
                  {head("due", t.columns.due)}
                  {head("created", t.columns.created)}
                </tr>
              </thead>
              <tbody>
                {result.items.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 tabular-nums">{r.number}</td>
                    <td className="px-3 py-2">
                      <Link href={`/${locale}/admin/requests/${r.id}`} className="font-medium text-brand underline underline-offset-4">
                        {r.subject}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.contactName}</div>
                      <div className="text-xs text-muted">{r.contactEmail}</div>
                    </td>
                    <td className="px-3 py-2">{t.statuses[r.status]}</td>
                    <td className="px-3 py-2">{r.assigneeName ?? <span className="text-muted">{t.unassigned}</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatTashkent(r.dueAt, tag, false)}
                      {isOverdue(r) && (
                        <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">{t.overdueBadge}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatTashkent(r.createdAt, tag, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={result.page} pages={result.pages} total={result.total} hrefFor={(p) => href({ page: p })} labels={dict.admin.invest.pager} ariaLabel={dict.nav.pagination} />
        </>
      )}
    </AdminShell>
  );
}
