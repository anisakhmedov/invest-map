import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { pickLocalized } from "@/lib/content";
import { formatBytes } from "@/lib/media";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { isOverdue } from "@/features/requests/sla";
import { RequestControls } from "./request-controls";
import { AdminLoading } from "@/components/loading-states";

export default function RequestDetail({ params }: PageProps<"/[lang]/admin/requests/[id]">) {
  return (
    <Suspense fallback={<AdminLoading kind="form" wide />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/[lang]/admin/requests/[id]">["params"] }) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const [user, dict] = await Promise.all([requirePermission(locale, "request", "view"), getDictionary()]);
  const t = dict.admin.requests;

  const [request, staff] = await Promise.all([
    db.request.findUnique({
      where: { id },
      include: {
        object: { select: { id: true, name: true } },
        assignee: { select: { fullName: true } },
        messages: { orderBy: { createdAt: "asc" }, include: { user: { select: { fullName: true } } } },
        attachments: { orderBy: { createdAt: "asc" } },
        tasks: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true } },
      },
    }),
    db.user.findMany({ where: { isActive: true, role: { key: { in: ["SUPER_ADMIN", "ADMIN", "REQUEST_MANAGER"] } } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  if (!request) notFound();

  const tag = htmlLang[locale];
  const overdue = isOverdue(request);

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="requests" title={`${t.request} #${request.number}`} wide>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section aria-label={t.thread} className="space-y-4">
            <article className="rounded-xl border border-border bg-surface p-4">
              <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{request.contactName}</span>
                <time className="text-xs text-muted">{formatTashkent(request.createdAt, tag)}</time>
              </header>
              <h2 className="mb-2 font-serif text-lg font-semibold">{request.subject}</h2>
              <p className="whitespace-pre-line leading-relaxed">{request.message}</p>
            </article>

            {request.attachments.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-sm">
                {request.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/requests/attachments/${a.id}`} className="inline-block rounded-lg border border-border bg-surface px-3 py-1.5 text-brand underline underline-offset-4">
                      {a.filename} <span className="text-muted">({formatBytes(a.size)})</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {request.messages.map((m) => (
              <article
                key={m.id}
                className={`rounded-xl border p-4 ${m.internal ? "border-amber-500/50 bg-amber-500/10" : m.fromStaff ? "border-brand/40 bg-brand-soft" : "border-border bg-surface"}`}
              >
                <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    {m.fromStaff ? (m.user?.fullName ?? t.staff) : request.contactName}
                    {m.internal && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs">{t.internalLabel}</span>}
                  </span>
                  <time className="text-xs text-muted">{formatTashkent(m.createdAt, tag)}</time>
                </header>
                <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
              </article>
            ))}
          </section>

          <RequestControls
            lang={locale}
            id={request.id}
            status={request.status}
            assigneeId={request.assigneeId}
            statuses={t.statuses}
            staff={staff.map((s) => ({ id: s.id, label: s.fullName }))}
            labels={{ ...t, ...t.controls }}
            errors={dict.admin.errors}
            canUpdate={can(user.role, "request", "update")}
          />
        </div>

        <aside className="space-y-5 text-sm">
          <dl className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <Row label={t.columns.from} value={request.contactName} />
            <Row label={t.email} value={<a href={`mailto:${request.contactEmail}`} className="text-brand underline underline-offset-4">{request.contactEmail}</a>} />
            {request.contactPhone && <Row label={t.phone} value={<a href={`tel:${request.contactPhone.replace(/[^\d+]/g, "")}`} className="text-brand underline underline-offset-4">{request.contactPhone}</a>} />}
            {request.object && (
              <Row label={t.object} value={<Link href={`/${locale}/admin/invest/${request.object.id}`} className="text-brand underline underline-offset-4">{pickLocalized(request.object.name, locale).text}</Link>} />
            )}
            <Row label={t.columns.created} value={formatTashkent(request.createdAt, tag)} />
            <Row
              label={t.columns.due}
              value={
                <>
                  {formatTashkent(request.dueAt, tag)}
                  {overdue && <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">{t.overdueBadge}</span>}
                </>
              }
            />
            {request.firstResponseAt && <Row label={t.firstResponse} value={formatTashkent(request.firstResponseAt, tag)} />}
          </dl>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-2 font-semibold">{t.tasks}</h2>
            {request.tasks.length === 0 ? (
              <p className="text-muted">{t.noTasks}</p>
            ) : (
              <ul className="space-y-1">
                {request.tasks.map((task) => (
                  <li key={task.id}>
                    <Link href={`/${locale}/admin/tasks/${task.id}`} className="text-brand underline underline-offset-4">{task.title}</Link>
                    <span className="ml-2 text-xs text-muted">{dict.admin.tasks.statuses[task.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {can(user.role, "task", "create") && (
              <Link href={`/${locale}/admin/tasks/new?request=${request.id}`} className="mt-3 inline-block font-medium text-brand underline underline-offset-4">
                {t.newTask}
              </Link>
            )}
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
