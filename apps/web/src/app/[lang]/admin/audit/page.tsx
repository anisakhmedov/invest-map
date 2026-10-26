import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatTashkent } from "@/lib/datetime";
import { parseDateRange } from "@/features/requests/reports";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { Pager } from "@/components/pager";
import { inputClass } from "@/components/admin-ui";
import { DateField } from "@/components/date-field";
import { Select } from "@/components/form-controls";
import { AdminLoading } from "@/components/loading-states";

const PAGE_SIZE = 50;
const MAX_JSON = 3000;

export default function AuditAdmin({ searchParams }: PageProps<"/[lang]/admin/audit">) {
  return (
    <Suspense fallback={<AdminLoading kind="table" wide lead filters />}>
      <Log searchParams={searchParams} />
    </Suspense>
  );
}

function pretty(value: unknown): { text: string; cut: boolean } {
  const full = JSON.stringify(value, null, 2) ?? "";
  return full.length > MAX_JSON ? { text: full.slice(0, MAX_JSON), cut: true } : { text: full, cut: false };
}

async function Log({ searchParams }: { searchParams: PageProps<"/[lang]/admin/audit">["searchParams"] }) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const [user, dict] = await Promise.all([requirePermission(locale, "audit", "view"), getDictionary()]);
  const t = dict.admin.audit;
  const first = (k: string) => {
    const v = params[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim();
  };
  const action = first("action").slice(0, 80);
  const entity = first("entity").slice(0, 60);
  const userId = first("user").slice(0, 40);
  const fromRaw = first("from");
  const toRaw = first("to");
  const range = parseDateRange(fromRaw, toRaw);
  const page = Math.max(1, Math.floor(Number(first("page"))) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
    ...(entity ? { entity } : {}),
    ...(userId ? { userId } : {}),
    ...(range.from || range.to ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } } : {}),
  };

  const [total, entities, people] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
    db.user.findMany({ where: { auditLogs: { some: {} } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" }, take: 300 }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = await db.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: { select: { fullName: true, email: true } } },
  });

  const href = (p: number) => {
    const s = new URLSearchParams();
    if (action) s.set("action", action);
    if (entity) s.set("entity", entity);
    if (userId) s.set("user", userId);
    if (fromRaw) s.set("from", fromRaw);
    if (toRaw) s.set("to", toRaw);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return `/${locale}/admin/audit${qs ? `?${qs}` : ""}`;
  };
  const tag = htmlLang[locale];

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="audit" title={t.title} wide>
      <p className="max-w-3xl text-muted">{t.lead}</p>

      <form method="get" className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="au-action" className="mb-1 block text-sm font-medium">{t.filters.action}</label>
          <input id="au-action" name="action" defaultValue={action} maxLength={80} className={inputClass} />
        </div>
        <div>
          <label htmlFor="au-entity" className="mb-1 block text-sm font-medium">{t.filters.entity}</label>
          <Select id="au-entity" name="entity" defaultValue={entity}>
            <option value="">{t.filters.all}</option>
            {entities.map((e) => (
              <option key={e.entity} value={e.entity}>{e.entity}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="au-user" className="mb-1 block text-sm font-medium">{t.filters.user}</label>
          <Select id="au-user" name="user" defaultValue={userId}>
            <option value="">{t.filters.all}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="au-from" className="mb-1 block text-sm font-medium">{t.filters.from}</label>
          <DateField id="au-from" name="from" defaultValue={fromRaw} labels={dict.datePicker} />
        </div>
        <div>
          <label htmlFor="au-to" className="mb-1 block text-sm font-medium">{t.filters.to}</label>
          <DateField id="au-to" name="to" defaultValue={toRaw} labels={dict.datePicker} />
        </div>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg">{t.filters.apply}</button>
          <Link href={`/${locale}/admin/audit`} className="text-sm font-medium text-brand underline underline-offset-4">{t.filters.reset}</Link>
        </div>
      </form>
      {(fromRaw || toRaw) && !range.from && !range.to && <p className="mt-2 text-sm text-muted">{t.badRange}</p>}

      {total === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.empty}</p>
      ) : (
        <>
          <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.time}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.user}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.action}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.object}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.ip}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t.columns.details}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const before = r.before == null ? null : pretty(r.before);
                  const after = r.after == null ? null : pretty(r.after);
                  return (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-3 py-3">{formatTashkent(r.createdAt, tag)}</td>
                      <td className="px-3 py-3">
                        {r.user ? (
                          <>
                            <div className="font-medium">{r.user.fullName}</div>
                            <div className="text-muted">{r.user.email}</div>
                          </>
                        ) : (
                          <span className="text-muted">{t.system}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{r.action}</td>
                      <td className="px-3 py-3">
                        <div>{r.entity}</div>
                        {r.entityId && <div className="break-all font-mono text-xs text-muted">{r.entityId}</div>}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{r.ip ?? ""}</td>
                      <td className="px-3 py-3">
                        {before || after ? (
                          <details>
                            <summary className="cursor-pointer font-medium text-brand underline underline-offset-4">{t.show}</summary>
                            <div className="mt-2 grid gap-3 lg:grid-cols-2">
                              {before && (
                                <div>
                                  <p className="text-xs font-medium text-muted">{t.before}</p>
                                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 text-xs">{before.text}</pre>
                                  {before.cut && <p className="text-xs text-muted">{t.truncated}</p>}
                                </div>
                              )}
                              {after && (
                                <div>
                                  <p className="text-xs font-medium text-muted">{t.after}</p>
                                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-2 text-xs">{after.text}</pre>
                                  {after.cut && <p className="text-xs text-muted">{t.truncated}</p>}
                                </div>
                              )}
                            </div>
                          </details>
                        ) : (
                          <span className="text-muted">{t.noDetails}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={current} pages={pages} total={total} hrefFor={href} labels={t.pager} ariaLabel={dict.nav.pagination} />
        </>
      )}
    </AdminShell>
  );
}
