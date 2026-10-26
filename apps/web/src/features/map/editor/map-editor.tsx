"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pickLocalized } from "@/lib/content";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import {
  deletePlan,
  deleteRegion,
  deleteRoad,
  deleteStop,
  importGeoJSON,
  savePlan,
  saveRegion,
  saveRoad,
  saveStop,
  type EditorResult,
} from "@/app/[lang]/admin/map-actions";
import { ErrorNote, Field, SavedNote, inputClass } from "@/components/admin-ui";
import { bboxOf, type PolygonGeometry } from "../model";
import { cornersFromBbox, type Corners, type LineGeometry } from "../geo";
import { EditorCanvas, type DisplayData, type EditKind, type EditTarget, type EditorGeometry } from "./editor-canvas";
import { Select } from "@/components/form-controls";

type L4 = Record<Locale, string>;
type Status = "DRAFT" | "PUBLISHED";

export type EditorRegion = { id: string; name: L4; description: L4; status: Status; geometry: PolygonGeometry };
export type EditorRoad = { id: string; name: L4; kind: "road" | "rail"; status: Status; geometry: LineGeometry };
export type EditorStop = { id: string; name: L4; kind: "bus" | "train" | "other"; status: Status; lng: number; lat: number };
export type EditorPlan = { id: string; name: L4; status: Status; mediaId: string; corners: Corners; opacity: number };
export type EditorImage = { id: string; filename: string };

type Draft = {
  name: L4;
  description: L4;
  status: Status;
  kind: string;
  mediaId: string;
  opacity: number;
  geometry: PolygonGeometry | LineGeometry | null;
  point: [number, number] | null;
  corners: Corners;
};

type Selected = { kind: EditKind; id: string | null } | null;

const blank = (): L4 => ({ uz: "", oz: "", ru: "", en: "" });
const DEFAULT_CORNERS: Corners = [[65, 42], [67, 42], [67, 40], [65, 40]];

const emptyDraft = (kind: EditKind, corners: Corners): Draft => ({
  name: blank(),
  description: blank(),
  status: "DRAFT",
  kind: kind === "road" ? "road" : kind === "stop" ? "bus" : "",
  mediaId: "",
  opacity: 0.7,
  geometry: null,
  point: null,
  corners,
});

export function MapEditor({
  lang,
  locale,
  dict,
  regions,
  roads,
  stops,
  plans,
  images,
  perms,
}: {
  lang: string;
  locale: Locale;
  dict: Dictionary["admin"];
  regions: EditorRegion[];
  roads: EditorRoad[];
  stops: EditorStop[];
  plans: EditorPlan[];
  images: EditorImage[];
  perms: { featureCreate: boolean; featureUpdate: boolean; featureDelete: boolean; featurePublish: boolean; layerCreate: boolean; layerUpdate: boolean; layerDelete: boolean; layerPublish: boolean };
}) {
  const t = dict.mapEditor;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<EditKind>("region");
  const [selected, setSelected] = useState<Selected>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft("region", DEFAULT_CORNERS));
  const [session, setSession] = useState(0);
  const [fit, setFit] = useState<{ bbox: [number, number, number, number]; nonce: number } | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "saved"; text: string } | null>(null);
  // JSON of the form as it was when editing began or was last saved, to tell if there is unsaved work.
  const [baseline, setBaseline] = useState("");
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fitCounter = useRef(0);

  const canSave = tab === "plan" ? (selected?.id ? perms.layerUpdate : perms.layerCreate) : selected?.id ? perms.featureUpdate : perms.featureCreate;
  const canDelete = tab === "plan" ? perms.layerDelete : perms.featureDelete;
  const canPublish = tab === "plan" ? perms.layerPublish : perms.featurePublish;
  const canCreate = tab === "plan" ? perms.layerCreate : perms.featureCreate;

  const homeCorners = useMemo<Corners>(() => {
    const first = regions[0];
    return first ? cornersFromBbox(shrink(bboxOf(first.geometry))) : DEFAULT_CORNERS;
  }, [regions]);

  const data = useMemo<DisplayData>(
    () => ({
      regions: regions.filter((r) => !(selected?.kind === "region" && selected.id === r.id)).map((r) => ({ id: r.id, geometry: r.geometry })),
      roads: roads.filter((r) => !(selected?.kind === "road" && selected.id === r.id)).map((r) => ({ id: r.id, geometry: r.geometry })),
      stops: stops.filter((s) => !(selected?.kind === "stop" && selected.id === s.id)).map((s) => ({ id: s.id, lng: s.lng, lat: s.lat })),
      plans: plans
        .filter((p) => !(selected?.kind === "plan" && selected.id === p.id))
        .map((p) => ({ id: p.id, imageUrl: `/api/media/${p.mediaId}`, corners: p.corners, opacity: p.opacity })),
    }),
    [regions, roads, stops, plans, selected],
  );

  const editing = useMemo<EditTarget | null>(() => {
    if (!selected) return null;
    switch (selected.kind) {
      case "region":
        return { kind: "region", id: selected.id, geometry: draft.geometry as PolygonGeometry | null };
      case "road":
        return { kind: "road", id: selected.id, geometry: draft.geometry as LineGeometry | null };
      case "stop":
        return { kind: "stop", id: selected.id, point: draft.point };
      case "plan":
        return { kind: "plan", id: selected.id, corners: draft.corners, imageUrl: draft.mediaId ? `/api/media/${draft.mediaId}` : null, opacity: draft.opacity };
    }
    // The canvas reads `editing` only when a session starts, so drawing edits don't re-enter it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, session]);

  const name = (n: unknown) => pickLocalized(n, locale).text || "—";

  const dirty = selected !== null && JSON.stringify(draft) !== baseline;

  // The browser's own "leave site?" prompt covers reloads and closing the tab.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmDiscard = () => !dirty || window.confirm(t.discardConfirm);

  function begin(next: Selected, nextDraft: Draft, bbox?: [number, number, number, number]) {
    setSelected(next);
    setDraft(nextDraft);
    setBaseline(JSON.stringify(nextDraft));
    setMessage(null);
    setSession((s) => s + 1);
    if (bbox) setFit({ bbox, nonce: ++fitCounter.current });
  }

  function startNew() {
    begin({ kind: tab, id: null }, emptyDraft(tab, homeCorners));
  }

  function startEdit(kind: EditKind, id: string) {
    setTab(kind);
    if (kind === "region") {
      const r = regions.find((x) => x.id === id);
      if (r) begin({ kind, id }, { ...emptyDraft(kind, homeCorners), name: r.name, description: r.description, status: r.status, geometry: r.geometry }, bboxOf(r.geometry));
    } else if (kind === "road") {
      const r = roads.find((x) => x.id === id);
      if (r) begin({ kind, id }, { ...emptyDraft(kind, homeCorners), name: r.name, status: r.status, kind: r.kind, geometry: r.geometry }, bboxOf({ type: "Polygon", coordinates: [r.geometry.coordinates] } as unknown as PolygonGeometry));
    } else if (kind === "stop") {
      const s = stops.find((x) => x.id === id);
      if (s) begin({ kind, id }, { ...emptyDraft(kind, homeCorners), name: s.name, status: s.status, kind: s.kind, point: [s.lng, s.lat] }, [s.lng, s.lat, s.lng, s.lat]);
    } else {
      const p = plans.find((x) => x.id === id);
      if (p) begin({ kind, id }, { ...emptyDraft(kind, homeCorners), name: p.name, status: p.status, mediaId: p.mediaId, opacity: p.opacity, corners: p.corners }, bboxOfCorners(p.corners));
    }
  }

  function cancel() {
    setSelected(null);
    setMessage(null);
    setSession((s) => s + 1);
  }

  function onGeometry(g: EditorGeometry) {
    setDraft((d) => (g.kind === "stop" ? { ...d, point: g.point } : { ...d, geometry: g.geometry }));
  }

  function errorText(code: string) {
    return (dict.errors as Record<string, string>)[code] ?? dict.errors.invalid;
  }

  function save() {
    if (!selected) return;
    const id = selected.id;
    const base = { name: draft.name, status: draft.status };
    let run: Promise<EditorResult>;
    if (selected.kind === "region") {
      if (!draft.geometry) return setMessage({ type: "error", text: t.geometryMissing });
      run = saveRegion(lang, id, { ...base, description: draft.description, geometry: draft.geometry });
    } else if (selected.kind === "road") {
      if (!draft.geometry) return setMessage({ type: "error", text: t.geometryMissing });
      run = saveRoad(lang, id, { ...base, kind: draft.kind, geometry: draft.geometry });
    } else if (selected.kind === "stop") {
      if (!draft.point) return setMessage({ type: "error", text: t.geometryMissing });
      run = saveStop(lang, id, { ...base, kind: draft.kind, point: { type: "Point", coordinates: draft.point } });
    } else {
      if (!draft.mediaId) return setMessage({ type: "error", text: errorText("planNeedsImage") });
      run = savePlan(lang, id, { ...base, mediaId: draft.mediaId, corners: draft.corners, opacity: draft.opacity });
    }
    startTransition(async () => {
      const res = await run;
      if (!res.ok) return setMessage({ type: "error", text: errorText(res.error) });
      setSelected({ kind: selected.kind, id: res.id });
      setMessage({ type: "saved", text: dict.common.saved });
      setBaseline(JSON.stringify(draft));
      router.refresh();
    });
  }

  function remove() {
    if (!selected?.id) return;
    const id = selected.id;
    const call = { region: deleteRegion, road: deleteRoad, stop: deleteStop, plan: deletePlan }[selected.kind];
    startTransition(async () => {
      const res = await call(lang, id);
      if (!res.ok) return setMessage({ type: "error", text: errorText(res.error) });
      cancel();
      router.refresh();
    });
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    setImportNote(null);
    const res = await importGeoJSON(lang, await file.text());
    if (fileInput.current) fileInput.current.value = "";
    if (!res.ok) return setImportNote(errorText(res.error));
    const skipped = res.issues.length ? `; ${t.skipped}: ${res.issues.length}` : "";
    setImportNote(`${t.imported}: ${res.regions + res.roads + res.stops}${skipped}`);
    router.refresh();
  }

  const list: { id: string; title: string; status: Status }[] =
    tab === "region" ? regions.map((r) => ({ id: r.id, title: name(r.name), status: r.status }))
    : tab === "road" ? roads.map((r) => ({ id: r.id, title: name(r.name), status: r.status }))
    : tab === "stop" ? stops.map((r) => ({ id: r.id, title: name(r.name), status: r.status }))
    : plans.map((r) => ({ id: r.id, title: name(r.name), status: r.status }));

  const multiPart = selected?.kind === "region" && draft.geometry?.type === "MultiPolygon";
  const hint = !selected ? null : multiPart ? t.multiPart : selected.kind === "plan" ? t.hintPlan : (selected.kind === "region" ? draft.geometry : selected.kind === "road" ? draft.geometry : draft.point) ? t.hintEdit : t.hintDraw[selected.kind];

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div role="tablist" aria-label={t.title} className="flex flex-wrap gap-1">
          {(["region", "road", "stop", "plan"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => {
                if (selected && !confirmDiscard()) return;
                setTab(k);
                if (selected) cancel();
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-brand text-brand-fg" : "border border-border bg-surface"}`}
            >
              {t.modes[k]}
            </button>
          ))}
        </div>

        {!selected && (
          <>
            {canCreate && (
              <button type="button" onClick={startNew} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg">
                {t.newItem[tab]}
              </button>
            )}
            {list.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted">{t.empty}</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {list.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => startEdit(tab, item.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2">
                      <span className="truncate">{item.title}</span>
                      <span className="text-xs text-muted">{item.status === "PUBLISHED" ? dict.common.published : dict.common.draft}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {perms.featureCreate && (
              <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
                <label htmlFor="geojson-file" className="block text-sm font-medium">{t.import}</label>
                <input id="geojson-file" ref={fileInput} type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(e) => onImport(e.target.files?.[0])} className="w-full text-sm" />
                <p className="text-xs text-muted">{t.importHint}</p>
                {importNote && <p role="status" className="text-sm">{importNote}</p>}
                <a href="/api/map/export" download className="inline-block text-sm font-medium text-brand underline underline-offset-4">{t.export}</a>
              </div>
            )}
          </>
        )}

        {selected && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-4 rounded-xl border border-border bg-surface p-4"
          >
            <h2 className="font-serif text-lg font-semibold">{selected.id ? dict.common.edit : t.newItem[selected.kind]}</h2>
            {message?.type === "error" && <ErrorNote>{message.text}</ErrorNote>}
            {message?.type === "saved" && <SavedNote>{message.text}</SavedNote>}
            {hint && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">{hint}</p>}

            {locales.map((l) => (
              <Field key={l} id={`ed-name-${l}`} label={`${t.name} (${localeLabels[l]})`}>
                <input id={`ed-name-${l}`} value={draft.name[l]} maxLength={200} onChange={(e) => setDraft((d) => ({ ...d, name: { ...d.name, [l]: e.target.value } }))} className={inputClass} />
              </Field>
            ))}

            {selected.kind === "region" &&
              locales.map((l) => (
                <Field key={l} id={`ed-desc-${l}`} label={`${t.description} (${localeLabels[l]})`}>
                  <textarea id={`ed-desc-${l}`} rows={2} value={draft.description[l]} maxLength={2000} onChange={(e) => setDraft((d) => ({ ...d, description: { ...d.description, [l]: e.target.value } }))} className={inputClass} />
                </Field>
              ))}

            {(selected.kind === "road" || selected.kind === "stop") && (
              <Field id="ed-kind" label={t.kind}>
                <Select id="ed-kind" value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
                  {(selected.kind === "road" ? ["road", "rail"] : ["bus", "train", "other"]).map((k) => (
                    <option key={k} value={k}>{t.kinds[k as keyof typeof t.kinds]}</option>
                  ))}
                </Select>
              </Field>
            )}

            {selected.kind === "plan" && (
              <>
                <Field id="ed-image" label={t.image}>
                  {images.length === 0 ? (
                    <p className="text-sm text-muted">{t.noImages}</p>
                  ) : (
                    <Select id="ed-image" value={draft.mediaId} onChange={(e) => { setDraft((d) => ({ ...d, mediaId: e.target.value })); setSession((s) => s + 1); }}>
                      <option value="">—</option>
                      {images.map((im) => (
                        <option key={im.id} value={im.id}>{im.filename}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field id="ed-opacity" label={`${t.opacity}: ${Math.round(draft.opacity * 100)}%`}>
                  <input id="ed-opacity" type="range" min={0.05} max={1} step={0.05} value={draft.opacity} onChange={(e) => setDraft((d) => ({ ...d, opacity: Number(e.target.value) }))} onPointerUp={() => setSession((s) => s + 1)} className="w-full" />
                </Field>
              </>
            )}

            <Field id="ed-status" label={dict.common.status}>
              <Select id="ed-status" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Status }))}>
                <option value="DRAFT">{dict.common.draft}</option>
                <option value="PUBLISHED" disabled={!canPublish}>{dict.common.published}</option>
              </Select>
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              {canSave && (
                <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-60">
                  {dict.common.save}
                </button>
              )}
              <button type="button" onClick={() => confirmDiscard() && cancel()} className="rounded-lg border border-border bg-surface px-4 py-2">
                {t.close}
              </button>
              {selected.kind !== "plan" && !multiPart && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft((d) => ({ ...d, geometry: null, point: null }));
                    setSession((x) => x + 1);
                  }}
                  className="rounded-lg border border-border bg-surface px-4 py-2"
                >
                  {t.redraw}
                </button>
              )}
              {selected.id && canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(dict.common.confirmDelete)) remove();
                  }}
                  className="text-red-600 underline underline-offset-4 dark:text-red-400"
                >
                  {dict.common.delete}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="h-[70dvh] min-h-[480px] overflow-hidden rounded-xl border border-border">
        <EditorCanvas
          data={data}
          editing={editing}
          sessionKey={`${session}`}
          fit={fit}
          onGeometry={onGeometry}
          onCorners={(corners) => setDraft((d) => ({ ...d, corners }))}
          onPick={(kind, id) => startEdit(kind, id)}
          labels={{ mapLabel: t.title, loadError: t.loadError }}
        />
      </div>
    </div>
  );
}

function shrink([w, s, e, n]: [number, number, number, number]): [number, number, number, number] {
  const dx = (e - w) * 0.25;
  const dy = (n - s) * 0.25;
  return [w + dx, s + dy, e - dx, n - dy];
}

function bboxOfCorners(c: Corners): [number, number, number, number] {
  const xs = c.map((p) => p[0]);
  const ys = c.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
