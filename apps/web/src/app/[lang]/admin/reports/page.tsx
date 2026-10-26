import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { pickLocalized } from "@/lib/content";
import { mailConfigured } from "@/lib/mailer";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { inputClass } from "@/components/admin-ui";
import { loadReport, parseReportQuery } from "@/features/requests/report-data";
import { REQUEST_STATUSES } from "@/features/requests/schemas";
import { AdminLoading } from "@/components/loading-states";

export default function ReportsAdmin({ searchParams }: PageProps<"/[lang]/admin/reports">) {
  return (
    <Suspense fallback={<AdminLoading kind="table" wide />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/[lang]/admin/reports">["searchParams"] }) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const [user, dict] = await Promise.all([requirePermission(locale, "report", "view"), getDictionary()]);
  const t = dict.admin.reports;
  const query = parseReportQuery((k) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  });
  const { report, regionNames, range } = await loadReport(query);
  const pendingMail = await db.emailOutbox.count({ where: { status: "PENDING" } });
  const nf = new Intl.NumberFormat(htmlLang[locale]);
  const csvHref = `/api/reports/requests${query.from || query.to ? `?${new URLSearchParams({ ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}) })}` : ""}`;
  const maxMonth = Math.max(1, ...report.byMonth.map((m) => m.count));
  const maxRegion = Math.max(1, ...report.byRegion.map((m) => m.count));

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="reports" title={t.title} wide>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="rp-from" className="mb-1 block text-sm font-medium">{t.from}</label>
          <input id="rp-from" name="from" type="date" defaultValue={query.from} className={inputClass} />
        </div>
        <div>
          <label htmlFor="rp-to" className="mb-1 block text-sm font-medium">{t.to}</label>
          <input id="rp-to" name="to" type="date" defaultValue={query.to} className={inputClass} />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg">{t.apply}</button>
        <Link href={`/${locale}/admin/reports`} className="pb-2 text-sm font-medium text-brand underline underline-offset-4">{t.reset}</Link>
        <a href={csvHref} download className="pb-2 text-sm font-medium text-brand underline underline-offset-4">{t.export}</a>
      </form>
      {(query.from || query.to) && !range.from && !range.to && <p className="mt-2 text-sm text-muted">{t.badRange}</p>}

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.total} value={nf.format(report.total)} />
        <Stat label={t.overdue} value={nf.format(report.overdue)} warn={report.overdue > 0} />
        <Stat label={t.avgResponse} value={report.avgFirstResponseHours === null ? "—" : `${nf.format(report.avgFirstResponseHours)} ${t.hours}`} />
        <Stat label={t.slaMet} value={report.slaMetPercent === null ? "—" : `${report.slaMetPercent}%`} />
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="rp-status">
          <h2 id="rp-status" className="mb-3 font-serif text-xl font-semibold">{t.byStatus}</h2>
          <Bars rows={REQUEST_STATUSES.map((s) => ({ label: dict.admin.requests.statuses[s], value: report.byStatus[s] }))} max={Math.max(1, report.total)} />
        </section>
        <section aria-labelledby="rp-month">
          <h2 id="rp-month" className="mb-3 font-serif text-xl font-semibold">{t.byMonth}</h2>
          {report.byMonth.length === 0 ? <p className="text-muted">{t.noData}</p> : <Bars rows={report.byMonth.map((m) => ({ label: m.month, value: m.count }))} max={maxMonth} />}
        </section>
        <section aria-labelledby="rp-region">
          <h2 id="rp-region" className="mb-3 font-serif text-xl font-semibold">{t.byRegion}</h2>
          {report.byRegion.length === 0 ? (
            <p className="text-muted">{t.noData}</p>
          ) : (
            <Bars
              rows={report.byRegion.map((r) => ({ label: r.regionId ? pickLocalized(regionNames.get(r.regionId), locale).text || "—" : t.noRegion, value: r.count }))}
              max={maxRegion}
            />
          )}
        </section>
      </div>

      <p className="mt-8 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
        {mailConfigured() ? t.mailOn : t.mailOff} {pendingMail > 0 && `${t.mailPending}: ${pendingMail}.`}
      </p>
    </AdminShell>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${warn ? "border-red-500/50 bg-red-500/10" : "border-border bg-surface"}`}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-3xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Horizontal bars. The numbers are always printed, so the chart never relies on colour or length alone. */
function Bars({ rows, max }: { rows: { label: string; value: number }[]; max: number }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate" title={r.label}>{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums font-medium">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}
