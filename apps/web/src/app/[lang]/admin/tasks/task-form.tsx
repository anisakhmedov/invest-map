"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTask } from "../request-actions";
import { ErrorNote, Field, inputClass } from "@/components/admin-ui";
import { fromTashkentInput } from "@/lib/datetime";
import { TASK_STATUSES } from "@/features/requests/schemas";
import type { DateFieldLabels } from "@/components/date-field";
import { DateField } from "@/components/date-field";
import { Select } from "@/components/form-controls";

export type TaskFormValues = {
  title: string;
  description: string;
  status: string;
  dueAt: string; // datetime-local in Tashkent time, or ""
  assigneeId: string;
  requestId: string;
};

export function TaskForm({
  lang,
  id,
  initial,
  staff,
  requestLabel,
  labels,
  statuses,
  common,
  errors,
  datePicker,
}: {
  lang: string;
  id: string | null;
  initial: TaskFormValues;
  staff: { id: string; label: string }[];
  requestLabel: string | null;
  labels: { title: string; description: string; status: string; dueAt: string; timeHint: string; assignee: string; unassigned: string; request: string };
  statuses: Record<string, string>;
  common: { save: string; back: string };
  errors: Record<string, string>;
  datePicker: DateFieldLabels;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof TaskFormValues>(k: K, value: TaskFormValues[K]) => setV((x) => ({ ...x, [k]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dueAt = v.dueAt ? fromTashkentInput(v.dueAt) : null;
    if (v.dueAt && !dueAt) return setError(errors.invalid);
    startTransition(async () => {
      const res = await saveTask(lang, id, {
        title: v.title,
        description: v.description,
        status: v.status,
        dueAt,
        assigneeId: v.assigneeId || null,
        requestId: v.requestId || null,
      });
      if (!res.ok) return setError(errors[res.error] ?? errors.invalid);
      router.push(v.requestId && !id ? `/${lang}/admin/requests/${v.requestId}` : `/${lang}/admin/tasks`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      {error && <ErrorNote>{error}</ErrorNote>}
      {requestLabel && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">
          <span className="font-medium">{labels.request}:</span> {requestLabel}
        </p>
      )}
      <Field id="t-title" label={labels.title}>
        <input id="t-title" required minLength={3} maxLength={200} value={v.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
      </Field>
      <Field id="t-desc" label={labels.description}>
        <textarea id="t-desc" rows={4} maxLength={5000} value={v.description} onChange={(e) => set("description", e.target.value)} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="t-status" label={labels.status}>
          <Select id="t-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{statuses[s]}</option>
            ))}
          </Select>
        </Field>
        <Field id="t-due" label={labels.dueAt} hint={labels.timeHint}>
          <DateField id="t-due" mode="datetime" value={v.dueAt} onChange={(e) => set("dueAt", e.target.value)} labels={datePicker} />
        </Field>
        <Field id="t-assignee" label={labels.assignee}>
          <Select id="t-assignee" value={v.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
            <option value="">{labels.unassigned}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg disabled:opacity-60">
          {common.save}
        </button>
        <button type="button" onClick={() => router.back()} className="rounded-lg border border-border bg-surface px-4 py-2.5">
          {common.back}
        </button>
      </div>
    </form>
  );
}
