import type { ReactNode } from "react";

import { primaryButtonClass } from "@/components/form-controls";

export { inputClass } from "@/components/form-controls";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function PrimaryButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={primaryButtonClass}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm">
      {children}
    </p>
  );
}

export function SavedNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-brand/50 bg-brand-soft px-3 py-2 text-sm">
      {children}
    </p>
  );
}
