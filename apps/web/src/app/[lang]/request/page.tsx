import { Suspense } from "react";
import { connection } from "next/server";
import { lang } from "next/root-params";
import { db } from "@/lib/db";
import { pickLocalized } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";
import { createFormToken } from "@/features/requests/spam";
import { authSecret } from "@/features/requests/links";
import { RequestForm } from "./request-form";
import { PublicLoading } from "@/components/loading-states";

export async function generateMetadata() {
  const dict = await getDictionary();
  return pageMetadata("/request", await lang(), dict.request.title, dict.request.lead);
}

export default async function RequestPage({ searchParams }: PageProps<"/[lang]/request">) {
  const dict = await getDictionary();
  return (
    <PageShell title={dict.request.title} lead={dict.request.lead}>
      <Suspense fallback={<PublicLoading kind="form" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/[lang]/request">["searchParams"] }) {
  await connection(); // the form token carries the render time, so this page must never be cached
  const [locale, dict, params] = await Promise.all([getLocale(), getDictionary(), searchParams]);
  const raw = Array.isArray(params.object) ? params.object[0] : params.object;

  let objectId = "";
  let objectName = "";
  if (raw && /^[a-z0-9]{1,40}$/i.test(raw)) {
    const object = await db.investObject.findFirst({ where: { id: raw, publish: "PUBLISHED" }, select: { id: true, name: true } });
    if (object) {
      objectId = object.id;
      objectName = pickLocalized(object.name, locale).text;
    }
  }

  return (
    <RequestForm
      lang={locale}
      formToken={createFormToken(authSecret())}
      objectId={objectId}
      objectName={objectName}
      labels={{ ...dict.request.fields, submit: dict.request.submit, privacy: dict.request.privacy }}
      errors={dict.request.errors}
    />
  );
}
