import Link from "next/link";
import { lang } from "next/root-params";
import { getDictionary } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";

export default async function NotFound() {
  const [locale, dict] = await Promise.all([lang(), getDictionary()]);
  return (
    <PageShell title={dict.notFound.title} lead={dict.notFound.text}>
      <Link href={`/${locale}`} className="font-medium text-brand underline underline-offset-4">
        {dict.notFound.home}
      </Link>
    </PageShell>
  );
}
