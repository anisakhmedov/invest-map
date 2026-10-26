/**
 * One look for every text field. Kept as a plain string so server and client components can share it.
 * Height is at least 44px for touch, the radius matches buttons, and invalid fields are marked with aria-invalid.
 */
export const fieldBase =
  "w-full min-h-11 rounded-xl border border-field-border bg-surface px-3.5 py-2 text-base text-fg shadow-[inset_0_1px_2px_oklch(0_0_0/0.04)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted/70 hover:border-fg/60 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 aria-invalid:border-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-[inset_0_1px_2px_oklch(0_0_0/0.3)]";

/** Kept under its old name: every existing text input and textarea picks up the new look. */
export const inputClass = fieldBase;

export const textareaClass = `${fieldBase} min-h-28 resize-y leading-relaxed`;

/** Primary action. Presses to 0.96 only where motion is allowed; hover only on pointers that can hover. */
export const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-medium text-brand-fg shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_1px_2px_oklch(0_0_0/0.12)] transition-[transform,opacity] duration-150 ease-out hover:opacity-90 motion-safe:enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60";

/** Secondary action: a quiet surface with a hairline border. */
export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 font-medium text-fg shadow-[0_1px_2px_oklch(0_0_0/0.05)] transition-[transform,background-color] duration-150 ease-out hover:bg-surface-2 motion-safe:enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60";
