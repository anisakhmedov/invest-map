import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatBytes } from "@/lib/media";
import { pickLocalized } from "@/lib/content";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AdminShell } from "@/components/admin-shell";
import { DeleteMediaButton } from "./delete-button";
import { UploadForm } from "./upload-form";
import { AdminLoading } from "@/components/loading-states";

export default function MediaAdmin() {
  return (
    <Suspense fallback={<AdminLoading kind="table" />}>
      <Library />
    </Suspense>
  );
}

async function Library() {
  const locale = await getLocale();
  const [user, dict] = await Promise.all([requirePermission(locale, "media", "view"), getDictionary()]);
  const assets = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const t = dict.admin;

  return (
    <AdminShell locale={locale} dict={dict} user={user} active="media" title={t.media.title}>
      {can(user.role, "media", "create") && (
        <UploadForm lang={locale} labels={t.media} errors={t.errors} savedLabel={t.common.saved} />
      )}

      {assets.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6 text-muted">{t.media.empty}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex aspect-[4/3] items-center justify-center bg-surface-2">
                {a.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/${a.id}`}
                    alt={pickLocalized(a.alt, locale).text}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-sm font-semibold text-muted">PDF</span>
                )}
              </div>
              <div className="space-y-2 p-3 text-sm">
                <p className="truncate font-medium" title={a.filename}>
                  {a.filename}
                </p>
                <p className="text-muted">
                  {t.media.size}: {formatBytes(a.size)}
                </p>
                <div className="flex items-center gap-3">
                  <a
                    href={`/api/media/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand underline underline-offset-4"
                  >
                    {t.media.open}
                  </a>
                  {can(user.role, "media", "delete") && (
                    <DeleteMediaButton lang={locale} id={a.id} label={t.common.delete} confirmMessage={t.common.confirmDelete} errors={t.errors} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
