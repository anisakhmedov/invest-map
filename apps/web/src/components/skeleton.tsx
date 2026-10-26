import type { ReactNode } from "react";

/**
 * Placeholder blocks shown while a page streams in. They copy the real layout (title size, lead, grid, table
 * rows) so the content lands in the same place and nothing jumps. The shimmer runs only when motion is allowed.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

/** Wraps a skeleton so assistive tech hears one "loading" status, not a stream of empty boxes. */
export function SkeletonPage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Title and lead, sized like PageShell so the text does not move when the page arrives. */
export function SkeletonHeading({ lead = true }: { lead?: boolean }) {
  return (
    <div>
      <Skeleton className="h-10 w-3/4 max-w-md sm:h-12" />
      {lead && (
        <div className="mt-5 space-y-2.5">
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-2/3 max-w-xl" />
        </div>
      )}
    </div>
  );
}

export function SkeletonCards({ count = 4, flush = false }: { count?: number; flush?: boolean }) {
  return (
    <ul className={`${flush ? "" : "mt-10 "}grid gap-6 md:grid-cols-2`}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="space-y-4 rounded-xl border border-border bg-surface p-5">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-1/3" />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonTable({ rows = 6, columns = 4, flush = false }: { rows?: number; columns?: number; flush?: boolean }) {
  return (
    <div className={`${flush ? "" : "mt-6 "}overflow-hidden rounded-xl border border-border bg-surface`}>
      <div className="flex gap-4 border-b border-border bg-surface-2 px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-t border-border px-4 py-4">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-xs" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 4, flush = false }: { fields?: number; flush?: boolean }) {
  return (
    <div className={`${flush ? "" : "mt-6 "}grid max-w-2xl gap-5 sm:grid-cols-2`}>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Map area with a side panel, the same split as the public map page. */
export function SkeletonMap({ flush = false }: { flush?: boolean }) {
  return (
    <div className={`${flush ? "" : "mt-6 "}grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]`}>
      <Skeleton className="aspect-[4/3] w-full rounded-xl lg:aspect-auto lg:min-h-[560px]" />
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

/** Lines of running text, for articles and tracking pages. */
export function SkeletonArticle() {
  return (
    <div className="max-w-3xl space-y-3">
      {["w-full", "w-11/12", "w-full", "w-10/12", "w-full", "w-2/3"].map((w, i) => (
        <Skeleton key={i} className={`h-4 ${w}`} />
      ))}
    </div>
  );
}
