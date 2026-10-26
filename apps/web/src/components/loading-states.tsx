import type { ReactNode } from "react";
import { getDictionary } from "@/i18n/get-dictionary";
import { Skeleton, SkeletonArticle, SkeletonCards, SkeletonForm, SkeletonHeading, SkeletonMap, SkeletonTable } from "./skeleton";

/** One "loading" status for assistive tech around a whole skeleton. */
async function Status({ children }: { children: ReactNode }) {
  const dict = await getDictionary();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{dict.public.loading}</span>
      {children}
    </div>
  );
}

/** Body placeholder for a public page whose title is already on screen (it sits outside the Suspense boundary). */
export function PublicLoading({ kind, count }: { kind: "cards" | "table" | "form" | "article"; count?: number }) {
  return (
    <Status>
      {kind === "cards" && <SkeletonCards flush count={count} />}
      {kind === "table" && <SkeletonTable flush rows={8} columns={5} />}
      {kind === "form" && <SkeletonForm flush fields={6} />}
      {kind === "article" && (
        <>
          <SkeletonHeading />
          <div className="mt-10">
            <SkeletonArticle />
          </div>
        </>
      )}
    </Status>
  );
}

/** Whole admin page: same menu and title position as AdminShell (`wide` is its full-width variant), so nothing moves when the page arrives. */
export function AdminLoading({ kind, wide = false, lead = false, filters = false }: { kind: "table" | "form" | "map"; wide?: boolean; lead?: boolean; filters?: boolean }) {
  return (
    <Status>
      <div className={`mx-auto grid grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6 ${wide ? "max-w-[1700px]" : "max-w-6xl md:grid-cols-[220px_minmax(0,1fr)]"}`}>
        <aside className={wide ? "flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3" : undefined}>
          <div className={`flex flex-wrap gap-2 ${wide ? "" : "md:flex-col md:gap-1"}`}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className={`h-9 w-24 ${wide ? "" : "md:w-full"}`} />
            ))}
          </div>
          {wide && <Skeleton className="h-9 w-40" />}
        </aside>
        <div>
          <SkeletonHeading lead={lead} />
          {filters && (
            <div className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ))}
              <Skeleton className="h-10 w-28 sm:col-span-2 lg:col-span-4" />
            </div>
          )}
          <div className="mt-6">
            {kind === "table" && <SkeletonTable flush rows={6} columns={4} />}
            {kind === "form" && <SkeletonForm flush fields={6} />}
            {kind === "map" && <SkeletonMap flush />}
          </div>
        </div>
      </div>
    </Status>
  );
}
