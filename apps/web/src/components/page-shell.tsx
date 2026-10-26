import type { ReactNode } from "react";

export function PageShell({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
      {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{lead}</p>}
      {children && <div className="mt-10">{children}</div>}
    </div>
  );
}
