import Link from "next/link";

export function Pager({
  page,
  pages,
  total,
  hrefFor,
  labels,
  ariaLabel,
}: {
  page: number;
  pages: number;
  total: number;
  hrefFor: (page: number) => string;
  labels: { prev: string; next: string; total: string };
  ariaLabel: string;
}) {
  const link = "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2";
  const off = "rounded-lg border border-border px-3 py-1.5 text-sm text-muted opacity-50";
  return (
    <nav aria-label={ariaLabel} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        {labels.total}: {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={link} rel="prev">
            {labels.prev}
          </Link>
        ) : (
          <span className={off} aria-disabled="true">{labels.prev}</span>
        )}
        <span aria-current="page">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={link} rel="next">
            {labels.next}
          </Link>
        ) : (
          <span className={off} aria-disabled="true">{labels.next}</span>
        )}
      </div>
    </nav>
  );
}
