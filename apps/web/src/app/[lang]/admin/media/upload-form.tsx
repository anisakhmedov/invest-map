"use client";

import { useActionState, useRef } from "react";
import { uploadMedia, type FormState } from "../cms-actions";
import { ErrorNote, Field, PrimaryButton, SavedNote, inputClass } from "@/components/admin-ui";
import { locales, localeLabels } from "@/i18n/config";

export function UploadForm({
  lang,
  labels,
  errors,
  savedLabel,
}: {
  lang: string;
  labels: { upload: string; file: string; alt: string; hint: string };
  errors: Record<string, string>;
  savedLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await uploadMedia(lang, prev, formData);
    if (result?.saved) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      {state?.error && <ErrorNote>{errors[state.error] ?? errors.invalid}</ErrorNote>}
      {state?.saved && <SavedNote>{savedLabel}</SavedNote>}
      <Field id="file" label={labels.file} hint={labels.hint}>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className={inputClass}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {locales.map((l) => (
          <Field key={l} id={`alt_${l}`} label={`${labels.alt} (${localeLabels[l]})`}>
            <input id={`alt_${l}`} name={`alt_${l}`} className={inputClass} maxLength={200} />
          </Field>
        ))}
      </div>
      <PrimaryButton pending={pending}>{labels.upload}</PrimaryButton>
    </form>
  );
}
