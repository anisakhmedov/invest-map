import { Suspense } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { ConfirmButton } from "@/components/confirm-button";
import { TASK_STATUSES } from "@/features/requests/schemas";
import { removeTask } from "../request-actions";
import { Select } from "@/components/form-controls";
import { AdminLoading } from "@/components/loading-states";

export default function TasksAdmin({ searchParams }: PageProps<"/[lang]/admin/tasks">) {
  return (
    <Suspense fallback={<AdminLoading kind="table" wide filters />}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/[lang]/admin/tasks">["searchParams"] }) {
  const [locale, params] = await Promise.all([getLocale(), searchParams]);
  const [user, dict] = await Promise.all([requirePermission(locale, "task", "view"), getDictionary()]);
  const t = dict.admin.tasks;
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const status = (TASK_STATUSES as readonly string[]).includes(one("status")) ? one("status") : "";
  const mine = one("mine") === "1";

  const tasks = await db.task.findMany({
    where: { ...(status ? { status: status as (typeof TASK_STATUSES)[number] } : {}), ...(mine ? { assigneeId: user.id } : {}) },
    orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    include: { assignee: { select: { fullName: true } }, request: { select: { id: true, number: true } } },
  });
  const tag = htmlLang[locale];
  const now = new Date();

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="tasks" title={t.title} wide>
      <div className="flex flex-wrap items-end gap-4">
        {can(user.role, "task", "create") && (
          <Link href={`/${locale}/admin/tasks/new`} className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg">{t.new}</Link>
        )}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="tk-status" className="mb-1 block text-sm font-medium">{t.fields.status}</label>
            <Select id="tk-status" name="status" defaultValue={status}>
              <option value="">{t.all}</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{t.statuses[s]}</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={mine} />
            {t.mine}
          </label>
          <button type="submit" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium">{t.apply}</button>
        </form>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.empty}</p>
      ) : (
        <div className="relative mt-6 scroll-edge overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t.fields.title}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.fields.status}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.fields.dueAt}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.fields.assignee}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t.fields.request}</th>
                <th scope="col" className="px-3 py-2 font-medium">{dict.admin.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const late = task.status !== "DONE" && task.dueAt !== null && task.dueAt < now;
                return (
                  <tr key={task.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-medium">{task.title}</td>
                    <td className="px-3 py-2">{t.statuses[task.status]}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {task.dueAt ? formatTashkent(task.dueAt, tag) : "—"}
                      {late && <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">{t.late}</span>}
                    </td>
                    <td className="px-3 py-2">{task.assignee?.fullName ?? "—"}</td>
                    <td className="px-3 py-2">
                      {task.request ? (
                        <Link href={`/${locale}/admin/requests/${task.request.id}`} className="text-brand underline underline-offset-4">#{task.request.number}</Link>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {can(user.role, "task", "update") && (
                          <Link href={`/${locale}/admin/tasks/${task.id}`} className="font-medium text-brand underline underline-offset-4">{dict.admin.common.edit}</Link>
                        )}
                        {can(user.role, "task", "delete") && (
                          <form action={removeTask.bind(null, locale, task.id)}>
                            <ConfirmButton message={dict.admin.common.confirmDelete} className="text-red-600 underline underline-offset-4 dark:text-red-400">
                              {dict.admin.common.delete}
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
