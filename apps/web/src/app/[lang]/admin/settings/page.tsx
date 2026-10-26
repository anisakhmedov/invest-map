import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getContacts } from "@/lib/site";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { ContactsForm } from "./contacts-form";
import { RequestSettingsForm } from "./request-settings-form";
import { getRequestSettings } from "@/features/requests/settings";
import { AdminLoading } from "@/components/loading-states";

export default function SettingsAdmin() {
  return (
    <Suspense fallback={<AdminLoading kind="form" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "settings", "view"), getDictionary()]);
  const [contacts, requestSettings] = await Promise.all([getContacts(), getRequestSettings()]);
  const t = dict.admin;

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="settings" title={t.settings.title}>
      <h2 className="mb-4 font-serif text-xl font-semibold">{t.settings.contacts}</h2>
      {can(user.role, "settings", "update") ? (
        <ContactsForm
          lang={locale}
          initial={contacts}
          labels={t.settings}
          errors={t.errors}
          savedLabel={t.common.saved}
          saveLabel={t.common.save}
        />
      ) : (
        <dl className="space-y-2 text-sm">
          <div><dt className="font-medium">{t.settings.email}</dt><dd className="text-muted">{contacts.email}</dd></div>
          <div><dt className="font-medium">{t.settings.phone}</dt><dd className="text-muted">{contacts.phone}</dd></div>
        </dl>
      )}
      {can(user.role, "settings", "update") && (
        <section className="mt-10">
          <h2 className="mb-4 font-serif text-xl font-semibold">{t.settings.requests.title}</h2>
          <RequestSettingsForm
            lang={locale}
            initial={requestSettings}
            labels={t.settings.requests}
            errors={dict.admin.errors}
            saveLabel={dict.admin.common.save}
            savedLabel={dict.admin.common.saved}
          />
        </section>
      )}
    </AdminShell>
  );
}
