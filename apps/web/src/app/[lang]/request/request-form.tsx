"use client";

import { useActionState } from "react";
import { submitRequest, type RequestFormState } from "./actions";
import { ErrorNote, Field, PrimaryButton, inputClass } from "@/components/admin-ui";
import { textareaClass } from "@/components/form-controls";

type Labels = {
  subject: string;
  message: string;
  name: string;
  email: string;
  phone: string;
  files: string;
  filesHint: string;
  relatedObject: string;
  submit: string;
  privacy: string;
};

export function RequestForm({
  lang,
  formToken,
  objectId,
  objectName,
  labels,
  errors,
}: {
  lang: string;
  formToken: string;
  objectId: string;
  objectName: string;
  labels: Labels;
  errors: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(submitRequest.bind(null, lang), undefined);
  const field = state?.field;

  return (
    <form action={action} className="max-w-3xl space-y-5" encType="multipart/form-data">
      {state?.error && (
        <ErrorNote>
          {errors[state.error] ?? errors.invalid}
          {state.error === "invalid" && field && labelFor(field, labels) ? `: ${labelFor(field, labels)}` : ""}
        </ErrorNote>
      )}

      <input type="hidden" name="ft" value={formToken} />
      <input type="hidden" name="objectId" value={objectId} />
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {objectName && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">
          <span className="font-medium">{labels.relatedObject}:</span> {objectName}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="r-name" label={labels.name}>
          <input id="r-name" name="contactName" required minLength={2} maxLength={120} autoComplete="name" className={inputClass} />
        </Field>
        <Field id="r-email" label={labels.email}>
          <input id="r-email" name="contactEmail" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
        </Field>
        <Field id="r-phone" label={labels.phone}>
          <input id="r-phone" name="contactPhone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} />
        </Field>
      </div>

      <Field id="r-subject" label={labels.subject}>
        <input id="r-subject" name="subject" required minLength={3} maxLength={200} className={inputClass} />
      </Field>
      <Field id="r-message" label={labels.message}>
        <textarea id="r-message" name="message" required minLength={10} maxLength={5000} rows={7} className={textareaClass} />
      </Field>
      <Field id="r-files" label={labels.files} hint={labels.filesHint}>
        <input id="r-files" name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="w-full text-sm" />
      </Field>

      <p className="text-sm text-muted">{labels.privacy}</p>
      <PrimaryButton pending={pending}>{labels.submit}</PrimaryButton>
    </form>
  );
}

function labelFor(field: string, labels: Labels): string {
  const map: Record<string, string> = {
    subject: labels.subject,
    message: labels.message,
    contactName: labels.name,
    contactEmail: labels.email,
    contactPhone: labels.phone,
  };
  return map[field] ?? "";
}
