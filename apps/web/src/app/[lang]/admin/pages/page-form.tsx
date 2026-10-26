"use client";

import { useActionState } from "react";
import { savePage, type FormState } from "../cms-actions";
import { ErrorNote, Field, PrimaryButton, inputClass } from "@/components/admin-ui";
import { locales, localeLabels } from "@/i18n/config";
import { Select, textareaClass } from "@/components/form-controls";

type Labels = {
  kind: string;
  kindPage: string;
  kindNews: string;
  status: string;
  draft: string;
  published: string;
  slug: string;
  slugHint: string;
  titleField: string;
  bodyField: string;
  bodyHint: string;
  languages: string;
  save: string;
};

type Initial = {
  kind: "PAGE" | "NEWS";
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  title: Record<string, string>;
  body: Record<string, string>;
};

export function PageForm({
  lang,
  id,
  initial,
  labels,
  errors,
  canPublish,
}: {
  lang: string;
  id: string | null;
  initial: Initial;
  labels: Labels;
  errors: Record<string, string>;
  canPublish: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePage.bind(null, lang, id), undefined);

  return (
    <form action={action} className="space-y-5">
      {state?.error && <ErrorNote>{errors[state.error] ?? errors.invalid}</ErrorNote>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="kind" label={labels.kind}>
          <Select id="kind" name="kind" defaultValue={initial.kind}>
            <option value="PAGE">{labels.kindPage}</option>
            <option value="NEWS">{labels.kindNews}</option>
          </Select>
        </Field>
        <Field id="status" label={labels.status}>
          <Select id="status" name="status" defaultValue={initial.status}>
            <option value="DRAFT">{labels.draft}</option>
            <option value="PUBLISHED" disabled={!canPublish}>
              {labels.published}
            </option>
          </Select>
        </Field>
        <Field id="slug" label={labels.slug} hint={labels.slugHint}>
          <input id="slug" name="slug" defaultValue={initial.slug} required className={inputClass} autoComplete="off" />
        </Field>
      </div>

      <div className="space-y-5">
        {locales.map((l) => (
          <fieldset key={l} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <legend className="px-2 text-sm font-semibold">{localeLabels[l]}</legend>
            <Field id={`title_${l}`} label={labels.titleField}>
              <input id={`title_${l}`} name={`title_${l}`} defaultValue={initial.title[l] ?? ""} className={inputClass} lang={l === "oz" ? "uz-Cyrl" : l === "uz" ? "uz-Latn" : l} />
            </Field>
            <Field id={`body_${l}`} label={labels.bodyField} hint={l === "uz" ? labels.bodyHint : undefined}>
              <textarea id={`body_${l}`} name={`body_${l}`} defaultValue={initial.body[l] ?? ""} rows={7} className={textareaClass} lang={l === "oz" ? "uz-Cyrl" : l === "uz" ? "uz-Latn" : l} />
            </Field>
          </fieldset>
        ))}
      </div>

      <PrimaryButton pending={pending}>{labels.save}</PrimaryButton>
    </form>
  );
}
