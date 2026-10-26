import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { toTashkentInput } from "@/lib/datetime";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { TaskForm, type TaskFormValues } from "./task-form";

export async function TaskFormPage({ id, requestId }: { id: string | null; requestId: string | null }) {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "task", id ? "update" : "create"), getDictionary()]);
  const t = dict.admin.tasks;

  const [task, staff] = await Promise.all([
    id ? db.task.findUnique({ where: { id } }) : null,
    db.user.findMany({ where: { isActive: true, role: { key: { in: ["SUPER_ADMIN", "ADMIN", "REQUEST_MANAGER"] } } }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  if (id && !task) notFound();

  const linkedId = task?.requestId ?? (requestId && /^[a-z0-9]{1,40}$/i.test(requestId) ? requestId : null);
  const linked = linkedId ? await db.request.findUnique({ where: { id: linkedId }, select: { id: true, number: true, subject: true } }) : null;

  const initial: TaskFormValues = task
    ? {
        title: task.title,
        description: task.description,
        status: task.status,
        dueAt: task.dueAt ? toTashkentInput(task.dueAt) : "",
        assigneeId: task.assigneeId ?? "",
        requestId: task.requestId ?? "",
      }
    : { title: "", description: "", status: "TODO", dueAt: "", assigneeId: user.id, requestId: linked?.id ?? "" };

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="tasks" title={id ? t.edit : t.new}>
      <TaskForm
        lang={locale}
        id={id}
        initial={initial}
        staff={staff.map((s) => ({ id: s.id, label: s.fullName }))}
        requestLabel={linked ? `#${linked.number} ${linked.subject}` : null}
        labels={t.fields}
        statuses={t.statuses}
        common={dict.admin.common}
        errors={dict.admin.errors}
        datePicker={dict.datePicker}
      />
    </AdminShell>
  );
}
