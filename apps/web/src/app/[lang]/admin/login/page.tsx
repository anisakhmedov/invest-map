import { Suspense } from "react";
import { redirect } from "next/navigation";
import { lang } from "next/root-params";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/rbac";
import { getDictionary } from "@/i18n/get-dictionary";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/[lang]/admin/login">) {
  return (
    <Suspense fallback={null}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: { searchParams: PageProps<"/[lang]/admin/login">["searchParams"] }) {
  const [locale, dict, query] = await Promise.all([lang(), getDictionary(), searchParams]);
  const user = await getCurrentUser();
  if (user && canAccessAdmin(user.role)) redirect(`/${locale}/admin`);
  const t = dict.admin.login;

  return (
    <section className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">{t.title}</h1>
      <LoginForm
        lang={locale}
        labels={t}
        errors={{ invalid: t.invalid, tooMany: t.tooMany, forbidden: t.forbidden }}
        initialError={query.error === "forbidden" ? "forbidden" : undefined}
      />
    </section>
  );
}
