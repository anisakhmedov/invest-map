import { lang } from "next/root-params";
import { getDictionary } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata() {
  const dict = await getDictionary();
  return pageMetadata("/about", await lang(), dict.about.title, dict.about.lead);
}

export default async function AboutPage() {
  const dict = await getDictionary();
  return (
    <PageShell title={dict.about.title} lead={dict.about.lead}>
      <dl className="grid gap-8 md:grid-cols-3">
        {dict.about.blocks.map((b) => (
          <div key={b.title} className="border-t-2 border-brand pt-4">
            <dt className="font-serif text-xl font-semibold">{b.title}</dt>
            <dd className="mt-2 leading-relaxed text-muted">{b.text}</dd>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
