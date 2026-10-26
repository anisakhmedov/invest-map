"use client";

import { useActionState } from "react";
import { saveUser, type UserFormState } from "../user-actions";
import { ErrorNote, Field, PrimaryButton, SavedNote, inputClass } from "@/components/admin-ui";
import { localeLabels, locales } from "@/i18n/config";
import { Select } from "@/components/form-controls";

type Labels = {
  email: string;
  fullName: string;
  locale: string;
  role: string;
  isActive: string;
  password: string;
  newPassword: string;
  passwordHint: string;
  newPasswordHint: string;
  signOutNote: string;
  selfNote: string;
  save: string;
  create: string;
  saved: string;
};

export type UserInitial = { email: string; fullName: string; locale: string; role: string; isActive: boolean };

export function UserForm({
  lang,
  id,
  initial,
  roles,
  isSelf,
  labels,
  errors,
}: {
  lang: string;
  id: string | null;
  initial: UserInitial;
  roles: { key: string; name: string }[];
  isSelf: boolean;
  labels: Labels;
  errors: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(saveUser.bind(null, lang, id), undefined);

  return (
    <form action={action} className="max-w-3xl space-y-5">
      {state?.error && <ErrorNote>{errors[state.error] ?? errors.invalid}</ErrorNote>}
      {state?.saved && <SavedNote>{labels.saved}</SavedNote>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="u-name" label={labels.fullName}>
          <input id="u-name" name="fullName" defaultValue={initial.fullName} required minLength={2} maxLength={120} autoComplete="off" className={inputClass} />
        </Field>
        <Field id="u-email" label={labels.email}>
          <input id="u-email" name="email" type="email" defaultValue={initial.email} required maxLength={254} autoComplete="off" className={inputClass} />
        </Field>
        <Field id="u-role" label={labels.role} hint={isSelf ? labels.selfNote : undefined}>
          <Select id="u-role" name="role" defaultValue={initial.role} disabled={isSelf}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>{r.name}</option>
            ))}
          </Select>
          {isSelf && <input type="hidden" name="role" value={initial.role} />}
        </Field>
        <Field id="u-locale" label={labels.locale}>
          <Select id="u-locale" name="locale" defaultValue={initial.locale}>
            {locales.map((l) => (
              <option key={l} value={l}>{localeLabels[l]}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field id="u-password" label={id ? labels.newPassword : labels.password} hint={id ? labels.newPasswordHint : labels.passwordHint}>
        <input
          id="u-password"
          name="password"
          type="password"
          required={!id}
          minLength={10}
          maxLength={200}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      {id && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isActive" defaultChecked={initial.isActive} disabled={isSelf} />
            {labels.isActive}
          </label>
          {isSelf && initial.isActive && <input type="hidden" name="isActive" value="on" />}
          <p className="mt-1 text-sm text-muted">{labels.signOutNote}</p>
        </div>
      )}

      <PrimaryButton pending={pending}>{id ? labels.save : labels.create}</PrimaryButton>
    </form>
  );
}
