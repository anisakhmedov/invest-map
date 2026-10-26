"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignRequest, replyAsStaff, setRequestStatus } from "../../request-actions";
import { ErrorNote, Field, PrimaryButton, SavedNote, inputClass } from "@/components/admin-ui";
import { Select } from "@/components/form-controls";

type Labels = {
  status: string;
  assignee: string;
  unassigned: string;
  reply: string;
  internalNote: string;
  internalHint: string;
  send: string;
  sent: string;
};

export function RequestControls({
  lang,
  id,
  status,
  assigneeId,
  statuses,
  staff,
  labels,
  errors,
  canUpdate,
}: {
  lang: string;
  id: string;
  status: string;
  assigneeId: string | null;
  statuses: Record<string, string>;
  staff: { id: string; label: string }[];
  labels: Labels;
  errors: Record<string, string>;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "saved"; text: string } | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okText?: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return setMessage({ type: "error", text: errors[res.error ?? "invalid"] ?? errors.invalid });
      if (okText) setMessage({ type: "saved", text: okText });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {message?.type === "error" && <ErrorNote>{message.text}</ErrorNote>}
      {message?.type === "saved" && <SavedNote>{message.text}</SavedNote>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rc-status" label={labels.status}>
          <Select
            id="rc-status"
            value={status}
            disabled={!canUpdate || pending}
            onChange={(e) => run(() => setRequestStatus(lang, id, e.target.value))}
          >
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field id="rc-assignee" label={labels.assignee}>
          <Select
            id="rc-assignee"
            value={assigneeId ?? ""}
            disabled={!canUpdate || pending}
            onChange={(e) => run(() => assignRequest(lang, id, e.target.value || null))}
          >
            <option value="">{labels.unassigned}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        </Field>
      </div>

      {canUpdate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const res = await replyAsStaff(lang, id, { body, internal });
              if (res.ok) setBody("");
              return res;
            }, labels.sent);
          }}
          className="space-y-3"
        >
          <Field id="rc-body" label={labels.reply}>
            <textarea id="rc-body" required maxLength={5000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="mt-1" />
            <span>
              {labels.internalNote}
              <span className="block text-muted">{labels.internalHint}</span>
            </span>
          </label>
          <PrimaryButton pending={pending}>{labels.send}</PrimaryButton>
        </form>
      )}
    </div>
  );
}
