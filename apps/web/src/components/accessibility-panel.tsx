"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

type Prefs = { font: "md" | "lg" | "xl"; contrast: boolean; motion: boolean };
const DEFAULTS: Prefs = { font: "md", contrast: false, motion: false };
const KEY = "a11y";
const EVENT = "a11y-change";

type Labels = {
  open: string;
  title: string;
  fontSize: string;
  fontMd: string;
  fontLg: string;
  fontXl: string;
  contrast: string;
  motion: string;
  reset: string;
  close: string;
};

function parse(raw: string): Prefs {
  try {
    const v = JSON.parse(raw) as Partial<Prefs>;
    return {
      font: v.font === "lg" || v.font === "xl" ? v.font : "md",
      contrast: v.contrast === true,
      motion: v.motion === true,
    };
  } catch {
    return DEFAULTS;
  }
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Mirrors the inline script in the layout, which applies the same attributes before first paint. */
function applyToPage(p: Prefs) {
  const root = document.documentElement;
  if (p.font === "md") delete root.dataset.font;
  else root.dataset.font = p.font;
  if (p.contrast) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  if (p.motion) root.dataset.motion = "reduce";
  else delete root.dataset.motion;
}

function save(p: Prefs) {
  applyToPage(p);
  try {
    if (p.font === "md" && !p.contrast && !p.motion) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the choice still applies until the page is closed */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function AccessibilityPanel({ labels }: { labels: Labels }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const prefs = raw ? parse(raw) : DEFAULTS;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Keep the page in step if another tab changes the setting.
  useEffect(() => applyToPage(raw ? parse(raw) : DEFAULTS), [raw]);

  // Escape closes the panel and gives focus back to the button; a click outside closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const fonts: { value: Prefs["font"]; label: string; size: string }[] = [
    { value: "md", label: labels.fontMd, size: "text-sm" },
    { value: "lg", label: labels.fontLg, size: "text-base" },
    { value: "xl", label: labels.fontXl, size: "text-lg" },
  ];

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-9 items-center gap-1.5 rounded-xl border border-field-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:border-fg/60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M12 12h9" />
        </svg>
        {/* The label stays for screen readers; on phones only the icon fits in the header. */}
        <span className="sr-only sm:not-sr-only">{labels.open}</span>
      </button>

      {open && (
        <div
          ref={panel}
          id={panelId}
          role="group"
          aria-label={labels.title}
          className="absolute right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg"
        >
          <fieldset>
            <legend className="mb-2 font-medium">{labels.fontSize}</legend>
            <div className="flex gap-2">
              {fonts.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={prefs.font === f.value}
                  onClick={() => save({ ...prefs, font: f.value })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 font-medium ${f.size} ${prefs.font === f.value ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={prefs.contrast} onChange={(e) => save({ ...prefs, contrast: e.target.checked })} />
            {labels.contrast}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={prefs.motion} onChange={(e) => save({ ...prefs, motion: e.target.checked })} />
            {labels.motion}
          </label>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => save(DEFAULTS)} className="font-medium text-brand underline underline-offset-4">
              {labels.reset}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
              className="rounded-lg border border-border px-3 py-1.5"
            >
              {labels.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
