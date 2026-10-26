"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importObjectsCsv, previewObjectsCsv, type CsvPreview } from "../invest-actions";
import { ErrorNote, SavedNote } from "@/components/admin-ui";

type Labels = {
  title: string;
  hint: string;
  columnsHint: string;
  choose: string;
  found: string;
  willUpdate: string;
  errorsTitle: string;
  row: string;
  field: string;
  ignored: string;
  importNow: string;
  created: string;
  updated: string;
  skipped: string;
  downgraded: string;
  rowErrors: Record<string, string>;
};

export function CsvImport({ lang, labels, errors }: { lang: string; labels: Labels; errors: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const problem = (code: string, missing?: string[]) =>
    `${errors[code] ?? errors.invalid}${missing?.length ? ` ${missing.join(", ")}` : ""}`;

  async function onFile(file: File | undefined) {
    setPreview(null);
    setResult(null);
    setText(null);
    if (!file) return;
    const content = await file.text();
    setText(content);
    setPreview(await previewObjectsCsv(lang, content));
  }

  function run() {
    if (text === null) return;
    startTransition(async () => {
      const res = await importObjectsCsv(lang, text);
      if (!res.ok) return setPreview({ ok: false, error: res.error, missing: res.missing });
      setResult(
        `${labels.created}: ${res.created}; ${labels.updated}: ${res.updated}; ${labels.skipped}: ${res.skipped}` +
          (res.downgraded ? `; ${labels.downgraded}: ${res.downgraded}` : ""),
      );
      setPreview(null);
      setText(null);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <section className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-serif text-lg font-semibold">{labels.title}</h2>
      <p className="text-sm text-muted">{labels.hint}</p>
      <p className="text-xs text-muted">{labels.columnsHint}</p>
      <div>
        <label htmlFor="csv-file" className="mb-1 block text-sm font-medium">{labels.choose}</label>
        <input id="csv-file" ref={input} type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="w-full text-sm" />
      </div>

      {result && <SavedNote>{result}</SavedNote>}
      {preview && !preview.ok && <ErrorNote>{problem(preview.error, preview.missing)}</ErrorNote>}

      {preview?.ok && (
        <div className="space-y-3 text-sm" aria-live="polite">
          <p>
            {labels.found}: <strong>{preview.valid}</strong>
            {preview.willUpdate > 0 && <> · {labels.willUpdate}: <strong>{preview.willUpdate}</strong></>}
          </p>
          {preview.ignoredColumns.length > 0 && (
            <p className="text-muted">{labels.ignored}: {preview.ignoredColumns.join(", ")}</p>
          )}
          {preview.errors.length > 0 && (
            <div>
              <p className="font-medium">{labels.errorsTitle}</p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-muted">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    {labels.row} {e.row}, {labels.field} «{e.field}»: {labels.rowErrors[e.code] ?? e.code}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.valid > 0 && (
            <button type="button" onClick={run} disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-60">
              {labels.importNow} ({preview.valid})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
