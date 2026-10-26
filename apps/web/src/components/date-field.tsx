"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { fieldBase } from "@/components/field-style";
import { Select } from "@/components/select";

export type DateFieldLabels = {
  pick: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  clear: string;
  done: string;
  hour: string;
  minute: string;
};

type DateFieldProps = {
  id?: string;
  name?: string;
  /** "date" holds YYYY-MM-DD, "datetime" holds YYYY-MM-DDTHH:mm — the same strings native inputs use. */
  mode?: "date" | "datetime";
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string; name: string } }) => void;
  required?: boolean;
  disabled?: boolean;
  labels: DateFieldLabels;
  "aria-describedby"?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));

type Parts = { y: number; m: number; d: number; hh: number; mm: number };

function parse(v: string): Parts | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v);
  if (!hit) return null;
  return { y: +hit[1], m: +hit[2] - 1, d: +hit[3], hh: +(hit[4] ?? 0), mm: +(hit[5] ?? 0) };
}

const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * A date (and optional time) field with a calendar we draw ourselves, so the picker matches the theme on
 * every browser. Values use the same strings as <input type="date|datetime-local">, a hidden input carries
 * them into forms and drives browser "required" validation, and the grid is operable with arrow keys.
 * Month and weekday names come from Intl in the page language, so only the few button texts need labels.
 */
export function DateField({
  id,
  name,
  mode = "date",
  value,
  defaultValue = "",
  onChange,
  required,
  disabled,
  labels,
  ...aria
}: DateFieldProps) {
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const withTime = mode === "datetime";

  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const parts = parse(current);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: 0, m: 0 });
  const [focusDay, setFocusDay] = useState(1);
  const [above, setAbove] = useState(false);
  const [endAligned, setEndAligned] = useState(false);

  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  const locale = typeof document === "undefined" ? "en" : document.documentElement.lang || "en";

  const commit = useCallback(
    (next: string) => {
      if (value === undefined) setInner(next);
      if (next !== current) onChange?.({ target: { value: next, name: name ?? "" } });
    },
    [current, name, onChange, value],
  );

  function openPicker() {
    if (disabled) return;
    const now = new Date();
    const base = parts ?? { y: now.getFullYear(), m: now.getMonth(), d: now.getDate(), hh: 0, mm: 0 };
    setView({ y: base.y, m: base.m });
    setFocusDay(base.d);
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setAbove(below < 400 && rect.top > below);
      setEndAligned(rect.left + 304 > window.innerWidth);
    }
    moveFocus.current = true;
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Move real focus onto the roving day button after a keyboard move, a month change, or opening.
  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    pop.current?.querySelector<HTMLButtonElement>('button[tabindex="0"][data-day]')?.focus();
  });

  const monthName = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(view.y, view.m, 1)),
    [locale, view.y, view.m],
  );
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))); // 2024-01-01 is a Monday
  }, [locale]);
  const dayLabel = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "full" }), [locale]);

  const cells = useMemo(() => {
    const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday first
    const days = new Date(view.y, view.m + 1, 0).getDate();
    return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [view.y, view.m]);
  const daysInView = cells.filter(Boolean).length;
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => {
    const row = cells.slice(w * 7, w * 7 + 7);
    return [...row, ...Array<null>(7 - row.length).fill(null)];
  });

  function shiftMonth(delta: number, keepDay = false) {
    const target = new Date(view.y, view.m + delta, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    setView({ y: target.getFullYear(), m: target.getMonth() });
    setFocusDay(keepDay ? Math.min(focusDay, last) : 1);
    moveFocus.current = keepDay;
  }

  function move(deltaDays: number) {
    const next = new Date(view.y, view.m, focusDay + deltaDays);
    setView({ y: next.getFullYear(), m: next.getMonth() });
    setFocusDay(next.getDate());
    moveFocus.current = true;
  }

  function onGridKey(e: KeyboardEvent) {
    const map: Record<string, () => void> = {
      ArrowLeft: () => move(-1),
      ArrowRight: () => move(1),
      ArrowUp: () => move(-7),
      ArrowDown: () => move(7),
      Home: () => move(-((new Date(view.y, view.m, focusDay).getDay() + 6) % 7)),
      End: () => move(6 - ((new Date(view.y, view.m, focusDay).getDay() + 6) % 7)),
      PageUp: () => shiftMonth(-1, true),
      PageDown: () => shiftMonth(1, true),
    };
    const run = map[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  }

  function pickDay(day: number) {
    const time = withTime ? `T${pad(parts?.hh ?? 0)}:${pad(parts?.mm ?? 0)}` : "";
    commit(iso(view.y, view.m, day) + time);
    if (!withTime) close(true);
  }

  function setTime(hh: number, mm: number) {
    const base = parts ?? { y: view.y, m: view.m, d: focusDay, hh: 0, mm: 0 };
    commit(`${iso(base.y, base.m, base.d)}T${pad(hh)}:${pad(mm)}`);
  }

  function pickToday() {
    const now = new Date();
    const time = withTime ? `T${pad(now.getHours())}:${pad(now.getMinutes())}` : "";
    commit(iso(now.getFullYear(), now.getMonth(), now.getDate()) + time);
    if (!withTime) close(true);
    else {
      setView({ y: now.getFullYear(), m: now.getMonth() });
      setFocusDay(now.getDate());
    }
  }

  const todayIso = (() => {
    const n = new Date();
    return iso(n.getFullYear(), n.getMonth(), n.getDate());
  })();

  const shown = parts
    ? `${pad(parts.d)}.${pad(parts.m + 1)}.${parts.y}${withTime ? ` ${pad(parts.hh)}:${pad(parts.mm)}` : ""}`
    : null;

  const navButton =
    "grid size-9 place-content-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg";

  return (
    <span ref={root} className="relative block w-full">
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${autoId}-dialog` : undefined}
        {...aria}
        disabled={disabled}
        onClick={() => (open ? close(false) : openPicker())}
        className={`${fieldBase} flex cursor-pointer items-center justify-between gap-2 text-start ${open ? "border-brand ring-4 ring-brand/15" : ""}`}
      >
        <span className={`tabular-nums ${shown ? "" : "text-muted/70"}`}>
          {shown ?? (withTime ? "––.––.–––– ––:––" : "––.––.––––")}
        </span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-4 shrink-0 ${open ? "text-brand" : "text-muted"}`}>
          <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <input
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={current}
        required={required}
        disabled={disabled}
        onChange={() => {}}
        onFocus={() => trigger.current?.focus()}
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0"
      />

      {open && (
        <div
          ref={pop}
          id={`${autoId}-dialog`}
          role="dialog"
          aria-label={labels.pick}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !e.defaultPrevented) {
              e.stopPropagation();
              close(true);
            }
          }}
          className={`select-pop absolute z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-3 shadow-[0_16px_40px_-8px_oklch(0_0_0/0.3),0_2px_6px_oklch(0_0_0/0.08)] ${endAligned ? "end-0" : "start-0"} ${above ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"}`}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button type="button" aria-label={labels.prevMonth} onClick={() => shiftMonth(-1)} className={navButton}>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180">
                <path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p aria-live="polite" className="text-sm font-semibold first-letter:uppercase">{monthName}</p>
            <button type="button" aria-label={labels.nextMonth} onClick={() => shiftMonth(1)} className={navButton}>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 rtl:rotate-180">
                <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div role="grid" aria-label={monthName} onKeyDown={onGridKey}>
            <div role="row" className="grid grid-cols-7 text-center text-xs text-muted">
              {weekdays.map((w, i) => (
                <span key={i} role="columnheader" className="py-1.5 font-medium">{w}</span>
              ))}
            </div>
            {weeks.map((week, w) => (
              <div key={w} role="row" className="grid grid-cols-7 gap-y-0.5">
                {week.map((day, i) => {
                  if (!day) return <span key={i} role="gridcell" aria-hidden="true" />;
                  const dayIso = iso(view.y, view.m, day);
                  const selected = parts !== null && dayIso === iso(parts.y, parts.m, parts.d);
                  const today = dayIso === todayIso;
                  return (
                    <span key={i} role="gridcell" aria-selected={selected} className="grid place-content-center">
                      <button
                        type="button"
                        data-day={day}
                        tabIndex={day === Math.min(focusDay, daysInView) ? 0 : -1}
                        aria-label={dayLabel.format(new Date(view.y, view.m, day))}
                        aria-current={today ? "date" : undefined}
                        onClick={() => pickDay(day)}
                        className={`grid size-9 place-content-center rounded-lg text-sm tabular-nums transition-colors ${
                          selected
                            ? "bg-brand font-semibold text-brand-fg"
                            : `hover:bg-brand-soft ${today ? "font-semibold text-brand ring-1 ring-inset ring-brand" : ""}`
                        }`}
                      >
                        {day}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          {withTime && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <Select
                size="sm"
                aria-label={labels.hour}
                value={pad(parts?.hh ?? 0)}
                onChange={(e) => setTime(+e.target.value, parts?.mm ?? 0)}
              >
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
              <span aria-hidden="true" className="font-semibold text-muted">:</span>
              <Select
                size="sm"
                aria-label={labels.minute}
                value={pad(parts?.mm ?? 0)}
                onChange={(e) => setTime(parts?.hh ?? 0, +e.target.value)}
              >
                {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
            <button type="button" onClick={pickToday} className="min-h-9 rounded-lg px-2.5 text-sm font-medium text-brand hover:bg-brand-soft">
              {labels.today}
            </button>
            <span className="flex items-center gap-1">
              {!required && current && (
                <button
                  type="button"
                  onClick={() => {
                    commit("");
                    close(true);
                  }}
                  className="min-h-9 rounded-lg px-2.5 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                >
                  {labels.clear}
                </button>
              )}
              {withTime && (
                <button type="button" onClick={() => close(true)} className="min-h-9 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg">
                  {labels.done}
                </button>
              )}
            </span>
          </div>
        </div>
      )}
    </span>
  );
}
