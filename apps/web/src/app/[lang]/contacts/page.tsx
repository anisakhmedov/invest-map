import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { lang } from "next/root-params";
import { getContacts } from "@/lib/site";
import { pickLocalized } from "@/lib/content";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { PageShell } from "@/components/page-shell";
import { pageMetadata } from "@/lib/seo";
import { PublicLoading } from "@/components/loading-states";

export async function generateMetadata() {
  const dict = await getDictionary();
  return pageMetadata("/contacts", await lang(), dict.contacts.title, dict.contacts.lead);
}

export default async function ContactsPage() {
  const dict = await getDictionary();
  return (
    <PageShell title={dict.contacts.title} lead={dict.contacts.lead}>
      <Suspense fallback={<PublicLoading kind="cards" count={2} />}>
        <ContactDetails />
      </Suspense>
    </PageShell>
  );
}

async function ContactDetails() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  await connection(); // data comes from the database at request time, so building needs no database
  const contacts = await getContacts();
  const address = pickLocalized(contacts.address, locale).text;
  const hasAny = contacts.email || contacts.phone || address;

  return (
    <div className="space-y-4">
      {hasAny ? (
        <dl className="space-y-4 rounded-xl border border-border bg-surface p-6">
          {address && (
            <div>
              <dt className="text-sm text-muted">{dict.admin.settings.address}</dt>
              <dd className="text-lg">{address}</dd>
            </div>
          )}
          {contacts.phone && (
            <div>
              <dt className="text-sm text-muted">{dict.admin.settings.phone}</dt>
              <dd className="text-lg">
                <a href={`tel:${contacts.phone.replace(/[^\d+]/g, "")}`} className="text-brand underline underline-offset-4">
                  {contacts.phone}
                </a>
              </dd>
            </div>
          )}
          {contacts.email && (
            <div>
              <dt className="text-sm text-muted">{dict.admin.settings.email}</dt>
              <dd className="text-lg">
                <a href={`mailto:${contacts.email}`} className="text-brand underline underline-offset-4">
                  {contacts.email}
                </a>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{dict.contacts.notSet}</p>
      )}
      <Link href={`/${locale}/request`} className="inline-block rounded-lg bg-brand px-5 py-3 font-medium text-brand-fg">
        {dict.home.sendRequest}
      </Link>
    </div>
  );
}
