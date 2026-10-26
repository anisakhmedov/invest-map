"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAuction } from "../invest-actions";
import { ErrorNote, Field, inputClass } from "@/components/admin-ui";
import { fromTashkentInput } from "@/lib/datetime";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { AUCTION_STATUSES } from "@/features/invest/schemas";
import type { DateFieldLabels } from "@/components/date-field";
import { DateField } from "@/components/date-field";
import { Select } from "@/components/form-controls";

type L4 = Record<Locale, string>;

export type AuctionFormValues = {
  objectId: string;
  status: string;
  publish: "DRAFT" | "PUBLISHED";
  startsAt: string; // datetime-local, Tashkent time
  endsAt: string;
  startPriceUsd: string;
  finalPriceUsd: string;
  terms: L4;
  resultNote: L4;
};

type Labels = {
  object: string; status: string; publish: string; startsAt: string; endsAt: string; timeHint: string;
  startPrice: string; finalPrice: string; finalHint: string; terms: string; resultNote: string;
};

export function AuctionForm({
  lang,
  id,
  initial,
  objects,
  labels,
  statuses,
  common,
  errors,
  canPublish,
  datePicker,
}: {
  lang: string;
  id: string | null;
  initial: AuctionFormValues;
  objects: { id: string; label: string }[];
  labels: Labels;
  statuses: Record<string, string>;
  common: { save: string; draft: string; published: string; back: string };
  errors: Record<string, string>;
  canPublish: boolean;
  datePicker: DateFieldLabels;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AuctionFormValues>(k: K, value: AuctionFormValues[K]) => setV((x) => ({ ...x, [k]: value }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const startsAt = fromTashkentInput(v.startsAt);
    const endsAt = fromTashkentInput(v.endsAt);
    if (!startsAt || !endsAt) return setError(errors.invalid);
    startTransition(async () => {
      const res = await saveAuction(lang, id, {
        objectId: v.objectId,
        status: v.status,
        publish: v.publish,
        startsAt,
        endsAt,
        startPriceUsd: num(v.startPriceUsd),
        finalPriceUsd: num(v.finalPriceUsd),
        terms: v.terms,
        resultNote: v.resultNote,
      });
      if (!res.ok) return setError(errors[res.error] ?? errors.invalid);
      router.push(`/${lang}/admin/auction`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      {error && <ErrorNote>{error}</ErrorNote>}

      <Field id="a-object" label={labels.object}>
        <Select id="a-object" required value={v.objectId} onChange={(e) => set("objectId", e.target.value)}>
          <option value="">—</option>
          {objects.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="a-starts" label={labels.startsAt} hint={labels.timeHint}>
          <DateField id="a-starts" mode="datetime" required value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} labels={datePicker} />
        </Field>
        <Field id="a-ends" label={labels.endsAt}>
          <DateField id="a-ends" mode="datetime" required value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} labels={datePicker} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="a-status" label={labels.status}>
          <Select id="a-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
            {AUCTION_STATUSES.map((s) => (
              <option key={s} value={s}>{statuses[s]}</option>
            ))}
          </Select>
        </Field>
        <Field id="a-start-price" label={labels.startPrice}>
          <input id="a-start-price" required inputMode="decimal" value={v.startPriceUsd} onChange={(e) => set("startPriceUsd", e.target.value)} className={inputClass} />
        </Field>
        <Field id="a-final-price" label={labels.finalPrice} hint={labels.finalHint}>
          <input id="a-final-price" inputMode="decimal" value={v.finalPriceUsd} onChange={(e) => set("finalPriceUsd", e.target.value)} className={inputClass} />
        </Field>
      </div>

      {locales.map((l) => (
        <fieldset key={l} className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <legend className="px-2 text-sm font-semibold">{localeLabels[l]}</legend>
          <Field id={`a-terms-${l}`} label={labels.terms}>
            <textarea id={`a-terms-${l}`} rows={3} maxLength={5000} value={v.terms[l]} onChange={(e) => set("terms", { ...v.terms, [l]: e.target.value })} className={inputClass} />
          </Field>
          <Field id={`a-note-${l}`} label={labels.resultNote}>
            <textarea id={`a-note-${l}`} rows={2} maxLength={2000} value={v.resultNote[l]} onChange={(e) => set("resultNote", { ...v.resultNote, [l]: e.target.value })} className={inputClass} />
          </Field>
        </fieldset>
      ))}

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <Field id="a-publish" label={labels.publish}>
          <Select id="a-publish" value={v.publish} onChange={(e) => set("publish", e.target.value as "DRAFT" | "PUBLISHED")}>
            <option value="DRAFT">{common.draft}</option>
            <option value="PUBLISHED" disabled={!canPublish}>{common.published}</option>
          </Select>
        </Field>
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg disabled:opacity-60">
            {common.save}
          </button>
          <button type="button" onClick={() => router.push(`/${lang}/admin/auction`)} className="rounded-lg border border-border bg-surface px-4 py-2.5">
            {common.back}
          </button>
        </div>
      </div>
    </form>
  );
}
