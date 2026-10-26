import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";
import { hashTrackingToken, isPlausibleToken } from "@/features/requests/tracking";
import { ReplyForm } from "./reply-form";
import { PublicLoading } from "@/components/loading-states";

// The address is the visitor's only key to this page: keep it out of search results and referrers.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function TrackingPage({ params }: PageProps<"/[lang]/request/track/[token]">) {
  return (
    <Suspense fallback={<PublicLoading kind="article" />}>
      <Tracking params={params} />
    </Suspense>
  );
}

async function Tracking({ params }: { params: PageProps<"/[lang]/request/track/[token]">["params"] }) {
  await connection();
  const [{ token }, locale, dict] = await Promise.all([params, getLocale(), getDictionary()]);
  if (!isPlausibleToken(token)) notFound();

  const request = await db.request.findUnique({
    where: { trackingHash: hashTrackingToken(token) },
    include: {
      messages: { where: { internal: false }, orderBy: { createdAt: "asc" } },
      attachments: { select: { id: true, filename: true } },
    },
  });
  if (!request) notFound();

  const t = dict.request.track;
  const tag = htmlLang[locale];
  const closed = request.status === "CLOSED";

  return (
    <PageShell title={t.title.replace("{number}", String(request.number))}>
      <div className="max-w-3xl space-y-8">
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">{t.saveLink}</p>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">{t.status}</dt>
            <dd className="font-semibold">{dict.admin.requests.statuses[request.status]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t.created}</dt>
            <dd className="font-semibold">{formatTashkent(request.createdAt, tag)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{dict.request.fields.subject}</dt>
            <dd className="font-semibold">{request.subject}</dd>
          </div>
        </dl>

        <section aria-label={t.thread} className="space-y-4">
          <Bubble who={t.you} when={formatTashkent(request.createdAt, tag)} body={request.message} />
          {request.attachments.length > 0 && (
            <p className="text-sm text-muted">
              {t.attachments}: {request.attachments.map((a) => a.filename).join(", ")}
            </p>
          )}
          {request.messages.map((m) => (
            <Bubble key={m.id} who={m.fromStaff ? t.staff : t.you} staff={m.fromStaff} when={formatTashkent(m.createdAt, tag)} body={m.body} />
          ))}
        </section>

        <section aria-labelledby="reply-title">
          <h2 id="reply-title" className="mb-3 font-serif text-xl font-semibold">{t.replyTitle}</h2>
          {closed ? (
            <p className="text-muted">{t.closedNote}</p>
          ) : (
            <ReplyForm lang={locale} token={token} labels={t} errors={dict.request.errors} />
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Bubble({ who, when, body, staff = false }: { who: string; when: string; body: string; staff?: boolean }) {
  return (
    <article className={`rounded-xl border p-4 ${staff ? "border-brand/40 bg-brand-soft" : "border-border bg-surface"}`}>
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{who}</span>
        <time className="text-xs text-muted">{when}</time>
      </header>
      <p className="whitespace-pre-line leading-relaxed">{body}</p>
    </article>
  );
}
