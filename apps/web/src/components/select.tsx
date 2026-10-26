"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { fieldBase } from "@/components/field-style";

type Option = { value: string; label: string; disabled: boolean; lang?: string };

/** The part of a change event our callers read. Matches the shape of a native select's event. */
export type SelectChangeEvent = {
  target: { value: string; name: string };
  currentTarget: { value: string; name: string };
};

type SelectProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: SelectChangeEvent) => void;
  required?: boolean;
  disabled?: boolean;
  size?: "md" | "sm";
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

function collect(children: ReactNode, out: Option[] = []): Option[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{
      value?: string | number;
      disabled?: boolean;
      lang?: string;
      children?: ReactNode;
    }>;
    if (el.type === Fragment || el.type === "optgroup") {
      collect(el.props.children, out);
      return;
    }
    if (el.type !== "option") return;
    const label = Children.toArray(el.props.children).join("");
    out.push({
      value: el.props.value !== undefined ? String(el.props.value) : label,
      label,
      disabled: Boolean(el.props.disabled),
      lang: el.props.lang,
    });
  });
  return out;
}

/**
 * A select with a list we draw ourselves, so the open state matches the rest of the form on every device.
 * Keeps what a native select gives for free: a name and value in forms, browser "required" validation,
 * arrow/Home/End/type-ahead keys, and a combobox + listbox pattern that screen readers announce.
 * Takes <option> children and an onChange(e.target.value), so it replaces <select> without other edits.
 */
export function Select({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  size = "md",
  className = "",
  children,
  ...aria
}: SelectProps) {
  const options = useMemo(() => collect(children), [children]);
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const listId = `${autoId}-list`;

  const [inner, setInner] = useState(defaultValue ?? options.find((o) => !o.disabled)?.value ?? "");
  const current = value ?? inner;
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [above, setAbove] = useState(false);

  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", timer: 0 as unknown as ReturnType<typeof setTimeout> });

  const openList = useCallback(() => {
    if (disabled) return;
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setAbove(below < 280 && rect.top > below);
    }
    setActive(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      if (value === undefined) setInner(option.value);
      if (option.value !== current) {
        const target = { value: option.value, name: name ?? "" };
        onChange?.({ target, currentTarget: target });
      }
      close(true);
    },
    [close, current, name, onChange, options, value],
  );

  // Close when the pointer lands outside, or when the page behind scrolls away from the trigger.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  function step(from: number, dir: 1 | -1) {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const first = options.findIndex((o) => !o.disabled);
    const last = options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled);

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(a, 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => step(a, -1));
        return;
      case "Home":
        e.preventDefault();
        setActive(first);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        return;
      case "Escape":
        e.preventDefault();
        close(true);
        return;
      case "Tab":
        setOpen(false);
        return;
    }

    // Type-ahead: jump to the next option that starts with what was typed.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      clearTimeout(typed.current.timer);
      typed.current.text += e.key.toLowerCase();
      typed.current.timer = setTimeout(() => (typed.current.text = ""), 600);
      const text = typed.current.text;
      const from = text.length === 1 ? active + 1 : active;
      const order = [...options.keys()];
      const hit = [...order.slice(from), ...order.slice(0, from)].find(
        (i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(text),
      );
      if (hit !== undefined) setActive(hit);
    }
  }

  const small = size === "sm";
  const trig = small ? "min-h-9 py-1.5 ps-3 pe-2.5 text-sm" : "pe-3";

  return (
    <span ref={root} className="relative block w-full">
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-required={required || undefined}
        {...aria}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
        className={`${fieldBase} ${trig} flex cursor-pointer items-center justify-between gap-2 text-start ${open ? "border-brand ring-4 ring-brand/15" : ""} ${className}`.trim()}
      >
        <span className={`truncate ${selected && selected.value !== "" ? "" : "text-muted"}`} lang={selected?.lang}>
          {selected?.label ?? " "}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`size-4 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180 text-brand" : ""}`}
        >
          <path d="M4 6.5 8 10.5 12 6.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Carries the value into forms and lets the browser show its "required" bubble on the trigger. */}
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
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={aria["aria-label"]}
          className={`select-pop absolute start-0 z-50 max-h-64 min-w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-[0_12px_32px_-8px_oklch(0_0_0/0.28),0_2px_6px_oklch(0_0_0/0.08)] ${above ? "bottom-full mb-1.5 origin-bottom" : "top-full mt-1.5 origin-top"}`}
        >
          {options.map((o, i) => {
            const isSelected = i === selectedIndex;
            return (
              <li
                key={`${o.value}-${i}`}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                lang={o.lang}
                aria-selected={isSelected}
                aria-disabled={o.disabled || undefined}
                onPointerMove={() => !o.disabled && setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                  o.disabled ? "cursor-not-allowed opacity-50" : ""
                } ${i === active ? "bg-brand-soft" : ""} ${isSelected ? "font-semibold text-brand" : ""}`}
              >
                <span className="whitespace-normal break-words">{o.label}</span>
                {isSelected && (
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}
