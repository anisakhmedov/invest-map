"use client";

import { useState, useTransition } from "react";
import { saveRequestSettings } from "../request-actions";
import { ErrorNote, Field, PrimaryButton, SavedNote, inputClass } from "@/components/admin-ui";

export function RequestSettingsForm({
  lang,
  initial,
  labels,
  errors,
  saveLabel,
  savedLabel,
}: {
  lang: string;
  initial: { slaHours: number; notifyEmail: string };
  labels: { slaHours: string; slaHint: string; notifyEmail: string; notifyHint: string };
  errors: Record<string, string>;
  saveLabel: string;
  savedLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [hours, setHours] = useState(String(initial.slaHours));
  const [email, setEmail] = useState(initial.notifyEmail);
  const [state, setState] = useState<{ type: "error" | "saved"; text: string } | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setState(null);
        startTransition(async () => {
          const res = await saveRequestSettings(lang, { slaHours: Number(hours), notifyEmail: email });
          setState(res.ok ? { type: "saved", text: savedLabel } : { type: "error", text: errors[res.error] ?? errors.invalid });
        });
      }}
      className="max-w-xl space-y-4"
    >
      {state?.type === "error" && <ErrorNote>{state.text}</ErrorNote>}
      {state?.type === "saved" && <SavedNote>{state.text}</SavedNote>}
      <Field id="rs-hours" label={labels.slaHours} hint={labels.slaHint}>
        <input id="rs-hours" type="number" min={1} max={1440} required value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} />
      </Field>
      <Field id="rs-email" label={labels.notifyEmail} hint={labels.notifyHint}>
        <input id="rs-email" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <PrimaryButton pending={pending}>{saveLabel}</PrimaryButton>
    </form>
  );
}
