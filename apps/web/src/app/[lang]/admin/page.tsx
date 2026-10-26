import { Suspense } from "react";
import Link from "next/link";
import { lang } from "next/root-params";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { AdminLoading } from "@/components/loading-states";

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading kind="table" />}>
      <Dashboard />
    </Suspense>
  );
}

const OPEN = ["NEW", "IN_PROGRESS"] as const;

async function Dashboard() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requireAdmin(await lang()), getDictionary()]);
  const t = dict.admin.cabinet;
  const tag = htmlLang[locale];
  const now = new Date();

  const seeRequests = can(user.role, "request", "view");
  const seeTasks = can(user.role, "task", "view");

  const [mine, unassigned, overdue, myRequests, myTasks] = await Promise.all([
    seeRequests ? db.request.count({ where: { assigneeId: user.id, status: { in: [...OPEN] } } }) : 0,
    seeRequests ? db.request.count({ where: { assigneeId: null, status: "NEW" } }) : 0,
    seeRequests ? db.request.count({ where: { status: { in: [...OPEN] }, dueAt: { lt: now } } }) : 0,
    seeRequests
      ? db.request.findMany({ where: { assigneeId: user.id, status: { in: [...OPEN] } }, orderBy: { dueAt: "asc" }, take: 6, select: { id: true, number: true, subject: true, dueAt: true, status: true } })
      : [],
    seeTasks
      ? db.task.findMany({ where: { assigneeId: user.id, status: { not: "DONE" } }, orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 8, select: { id: true, title: true, dueAt: true, status: true } })
      : [],
  ]);

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="dashboard" title={dict.admin.dashboard}>
      <p className="text-muted">
        {dict.admin.welcome}, {user.fullName}.
      </p>

      {seeRequests && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Counter href={`/${locale}/admin/requests?assignee=me`} label={t.myOpen} value={mine} />
          <Counter href={`/${locale}/admin/requests?assignee=none&status=NEW`} label={t.unassigned} value={unassigned} />
          <Counter href={`/${locale}/admin/requests?overdue=1`} label={t.overdue} value={overdue} warn={overdue > 0} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {seeRequests && (
          <section aria-labelledby="cab-requests">
            <h2 id="cab-requests" className="mb-3 font-serif text-xl font-semibold">{t.myRequests}</h2>
            {myRequests.length === 0 ? (
              <p className="text-muted">{t.noRequests}</p>
            ) : (
              <ul className="space-y-2">
                {myRequests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    <Link href={`/${locale}/admin/requests/${r.id}`} className="font-medium text-brand underline underline-offset-4">
                      #{r.number} {r.subject}
                    </Link>
                    <div className="text-xs text-muted">
                      {t.due}: {formatTashkent(r.dueAt, tag, false)} {r.dueAt < now && <strong className="text-red-700 dark:text-red-300">· {t.late}</strong>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {seeTasks && (
          <section aria-labelledby="cab-tasks">
            <h2 id="cab-tasks" className="mb-3 font-serif text-xl font-semibold">{t.myTasks}</h2>
            {myTasks.length === 0 ? (
              <p className="text-muted">{t.noTasks}</p>
            ) : (
              <ul className="space-y-2">
                {myTasks.map((task) => (
                  <li key={task.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    <Link href={`/${locale}/admin/tasks/${task.id}`} className="font-medium text-brand underline underline-offset-4">{task.title}</Link>
                    <div className="text-xs text-muted">
                      {task.dueAt ? `${t.due}: ${formatTashkent(task.dueAt, tag)}` : t.noDue} {task.dueAt && task.dueAt < now && <strong className="text-red-700 dark:text-red-300">· {t.late}</strong>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function Counter({ href, label, value, warn = false }: { href: string; label: string; value: number; warn?: boolean }) {
  return (
    <Link href={href} className={`block rounded-xl border p-4 hover:bg-surface-2 ${warn ? "border-red-500/50 bg-red-500/10" : "border-border bg-surface"}`}>
      <span className="block text-sm text-muted">{label}</span>
      <span className="mt-1 block font-serif text-3xl font-semibold tabular-nums">{value}</span>
    </Link>
  );
}
