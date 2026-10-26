"use client";

import { useActionState } from "react";
import { saveContacts, type FormState } from "../cms-actions";
import { ErrorNote, Field, PrimaryButton, SavedNote, inputClass } from "@/components/admin-ui";
import { locales, localeLabels } from "@/i18n/config";

type Initial = { email: string; phone: string; address: Record<string, string> };

export function ContactsForm({
  lang,
  initial,
  labels,
  errors,
  savedLabel,
  saveLabel,
}: {
  lang: string;
  initial: Initial;
  labels: { email: string; phone: string; address: string };
  errors: Record<string, string>;
  savedLabel: string;
  saveLabel: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveContacts.bind(null, lang), undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <ErrorNote>{errors[state.error] ?? errors.invalid}</ErrorNote>}
      {state?.saved && <SavedNote>{savedLabel}</SavedNote>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label={labels.email}>
          <input id="email" name="email" type="email" defaultValue={initial.email} className={inputClass} />
        </Field>
        <Field id="phone" label={labels.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={initial.phone} className={inputClass} />
        </Field>
      </div>
      {locales.map((l) => (
        <Field key={l} id={`address_${l}`} label={`${labels.address} (${localeLabels[l]})`}>
          <input id={`address_${l}`} name={`address_${l}`} defaultValue={initial.address[l] ?? ""} className={inputClass} maxLength={300} />
        </Field>
      ))}
      <PrimaryButton pending={pending}>{saveLabel}</PrimaryButton>
    </form>
  );
}
