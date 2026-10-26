"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveObject } from "../invest-actions";
import { ErrorNote, Field, inputClass } from "@/components/admin-ui";
import { OBJECT_CATEGORIES, OBJECT_STATUSES } from "@/features/map/model";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { Select } from "@/components/form-controls";

type L4 = Record<Locale, string>;

export type ObjectFormValues = {
  regionId: string;
  name: L4;
  description: L4;
  category: string;
  status: string;
  areaHa: string;
  priceUsd: string;
  lng: string;
  lat: string;
  publish: "DRAFT" | "PUBLISHED";
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  documentIds: string[];
};

type Labels = {
  region: string; name: string; description: string; category: string; status: string; area: string; price: string;
  priceHint: string; lng: string; lat: string; coordsHint: string; publish: string; contacts: string; contactName: string;
  contactPhone: string; contactEmail: string; documents: string; documentsHint: string; noDocuments: string;
};

export function ObjectForm({
  lang,
  id,
  initial,
  regions,
  files,
  labels,
  common,
  categories,
  statuses,
  errors,
  canPublish,
}: {
  lang: string;
  id: string | null;
  initial: ObjectFormValues;
  regions: { id: string; label: string }[];
  files: { id: string; label: string }[];
  labels: Labels;
  common: { save: string; draft: string; published: string; back: string };
  categories: Record<string, string>;
  statuses: Record<string, string>;
  errors: Record<string, string>;
  canPublish: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState<ObjectFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ObjectFormValues>(key: K, value: ObjectFormValues[K]) => setV((x) => ({ ...x, [key]: value }));

  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveObject(
        lang,
        id,
        {
          regionId: v.regionId,
          name: v.name,
          description: v.description,
          category: v.category,
          status: v.status,
          areaHa: num(v.areaHa),
          priceUsd: num(v.priceUsd),
          lng: num(v.lng),
          lat: num(v.lat),
          publish: v.publish,
          contactName: v.contactName,
          contactPhone: v.contactPhone,
          contactEmail: v.contactEmail,
        },
        v.documentIds,
      );
      if (!res.ok) return setError(errors[res.error] ?? errors.invalid);
      router.push(`/${lang}/admin/invest`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="o-region" label={labels.region}>
          <Select id="o-region" required value={v.regionId} onChange={(e) => set("regionId", e.target.value)}>
            <option value="">—</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </Select>
        </Field>
        <Field id="o-category" label={labels.category}>
          <Select id="o-category" value={v.category} onChange={(e) => set("category", e.target.value)}>
            {OBJECT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{categories[c]}</option>
            ))}
          </Select>
        </Field>
        <Field id="o-status" label={labels.status}>
          <Select id="o-status" value={v.status} onChange={(e) => set("status", e.target.value)}>
            {OBJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{statuses[s]}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field id="o-area" label={labels.area}>
          <input id="o-area" required inputMode="decimal" value={v.areaHa} onChange={(e) => set("areaHa", e.target.value)} className={inputClass} />
        </Field>
        <Field id="o-price" label={labels.price} hint={labels.priceHint}>
          <input id="o-price" inputMode="decimal" value={v.priceUsd} onChange={(e) => set("priceUsd", e.target.value)} className={inputClass} />
        </Field>
        <Field id="o-lng" label={labels.lng}>
          <input id="o-lng" required inputMode="decimal" value={v.lng} onChange={(e) => set("lng", e.target.value)} className={inputClass} />
        </Field>
        <Field id="o-lat" label={labels.lat}>
          <input id="o-lat" required inputMode="decimal" value={v.lat} onChange={(e) => set("lat", e.target.value)} className={inputClass} />
        </Field>
      </div>
      <p className="-mt-3 text-sm text-muted">{labels.coordsHint}</p>

      {locales.map((l) => (
        <fieldset key={l} className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <legend className="px-2 text-sm font-semibold">{localeLabels[l]}</legend>
          <Field id={`o-name-${l}`} label={labels.name}>
            <input id={`o-name-${l}`} maxLength={200} value={v.name[l]} onChange={(e) => set("name", { ...v.name, [l]: e.target.value })} className={inputClass} />
          </Field>
          <Field id={`o-desc-${l}`} label={labels.description}>
            <textarea id={`o-desc-${l}`} rows={3} maxLength={2000} value={v.description[l]} onChange={(e) => set("description", { ...v.description, [l]: e.target.value })} className={inputClass} />
          </Field>
        </fieldset>
      ))}

      <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <legend className="px-2 text-sm font-semibold">{labels.contacts}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="o-cname" label={labels.contactName}>
            <input id="o-cname" maxLength={120} value={v.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputClass} />
          </Field>
          <Field id="o-cphone" label={labels.contactPhone}>
            <input id="o-cphone" type="tel" maxLength={40} value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputClass} />
          </Field>
          <Field id="o-cemail" label={labels.contactEmail}>
            <input id="o-cemail" type="email" maxLength={254} value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputClass} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border bg-surface p-4">
        <legend className="px-2 text-sm font-semibold">{labels.documents}</legend>
        {files.length === 0 ? (
          <p className="text-sm text-muted">{labels.noDocuments}</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">{labels.documentsHint}</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {files.map((f) => (
                <li key={f.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={v.documentIds.includes(f.id)}
                      onChange={(e) => set("documentIds", e.target.checked ? [...v.documentIds, f.id] : v.documentIds.filter((x) => x !== f.id))}
                    />
                    {f.label}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </fieldset>

      <div className="grid items-end gap-4 sm:grid-cols-3">
        <Field id="o-publish" label={labels.publish}>
          <Select id="o-publish" value={v.publish} onChange={(e) => set("publish", e.target.value as "DRAFT" | "PUBLISHED")}>
            <option value="DRAFT">{common.draft}</option>
            <option value="PUBLISHED" disabled={!canPublish}>{common.published}</option>
          </Select>
        </Field>
        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-fg disabled:opacity-60">
            {common.save}
          </button>
          <button type="button" onClick={() => router.push(`/${lang}/admin/invest`)} className="rounded-lg border border-border bg-surface px-4 py-2.5">
            {common.back}
          </button>
        </div>
      </div>
    </form>
  );
}
