import Link from "next/link";
import { lang } from "next/root-params";
import { getDictionary } from "@/i18n/get-dictionary";
import { PageShell } from "./page-shell";

export async function ComingSoon({ title }: { title: string }) {
  const [locale, dict] = await Promise.all([lang(), getDictionary()]);
  return (
    <PageShell title={title} lead={dict.soon.text}>
      <p className="mb-6 inline-block rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-muted">
        {dict.soon.title}
      </p>
      <div>
        <Link href={`/${locale}`} className="font-medium text-brand underline underline-offset-4">
          {dict.soon.back}
        </Link>
      </div>
    </PageShell>
  );
}
