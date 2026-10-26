"use client";

import Link from "next/link";
import { pickLocalized } from "@/lib/content";
import { formatTashkent } from "@/lib/datetime";
import { htmlLang, type Locale } from "@/i18n/config";
import { STATUS_COLORS, regionSummary, type MapObject, type MapRegion, type ObjectStatusKey } from "./model";

export type MapLabels = {
  categories: Record<string, string>;
  statuses: Record<string, string>;
  region: string;
  objectsCount: string;
  availableCount: string;
  totalArea: string;
  area: string;
  price: string;
  priceOnRequest: string;
  sendRequest: string;
  close: string;
  ha: string;
  listTitle: string;
  emptyList: string;
  typeLabel: string;
  kinds: Record<string, string>;
  auctionLabel: string;
  auctionStartPrice: string;
};

export function StatusBadge({ status, labels }: { status: ObjectStatusKey; labels: MapLabels }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[status] }} />
      {labels.statuses[status]}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function CardShell({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-surface p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold leading-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-xl leading-none text-muted hover:bg-surface-2 hover:text-fg"
        >
          ×
        </button>
      </div>
      {children}
    </section>
  );
}

export function ObjectCard({
  object,
  region,
  locale,
  labels,
  contactsHref,
  onClose,
}: {
  object: MapObject;
  region: MapRegion | undefined;
  locale: Locale;
  labels: MapLabels;
  contactsHref: string;
  onClose: () => void;
}) {
  const nf = new Intl.NumberFormat(htmlLang[locale]);
  const description = pickLocalized(object.description, locale).text;
  return (
    <CardShell title={pickLocalized(object.name, locale).text} onClose={onClose} closeLabel={labels.close}>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={object.status} labels={labels} />
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium">{labels.categories[object.category]}</span>
      </div>
      {description && <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {region && <Stat label={labels.region} value={pickLocalized(region.name, locale).text} />}
        <Stat label={labels.area} value={`${nf.format(object.areaHa)} ${labels.ha}`} />
        <Stat label={labels.price} value={object.priceUsd === null ? labels.priceOnRequest : `$${nf.format(object.priceUsd)}`} />
      </dl>
      {object.auction && (
        <p className="mt-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="font-semibold">{labels.auctionLabel}:</span>{" "}
          {formatTashkent(new Date(object.auction.startsAt), htmlLang[locale])} — {formatTashkent(new Date(object.auction.endsAt), htmlLang[locale])}
          <br />
          <span className="text-muted">
            {labels.auctionStartPrice}: ${nf.format(object.auction.startPriceUsd)}
          </span>
        </p>
      )}
      <Link
        href={contactsHref}
        className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:opacity-90"
      >
        {labels.sendRequest}
      </Link>
    </CardShell>
  );
}

export function RegionCard({
  region,
  objects,
  locale,
  labels,
  onSelectObject,
  onClose,
}: {
  region: MapRegion;
  objects: MapObject[];
  locale: Locale;
  labels: MapLabels;
  onSelectObject: (id: string) => void;
  onClose: () => void;
}) {
  const nf = new Intl.NumberFormat(htmlLang[locale]);
  const summary = regionSummary(region.id, objects);
  const own = objects.filter((o) => o.regionId === region.id);
  const description = pickLocalized(region.description, locale).text;
  return (
    <CardShell title={pickLocalized(region.name, locale).text} onClose={onClose} closeLabel={labels.close}>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Stat label={labels.objectsCount} value={nf.format(summary.count)} />
        <Stat label={labels.availableCount} value={nf.format(summary.available)} />
        <Stat label={labels.totalArea} value={`${nf.format(summary.totalAreaHa)} ${labels.ha}`} />
      </dl>
      {own.length > 0 && (
        <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto">
          {own.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onSelectObject(o.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <span className="truncate">{pickLocalized(o.name, locale).text}</span>
                <StatusBadge status={o.status} labels={labels} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}

export function LineOrPointCard({ title, kind, labels, onClose }: { title: string; kind: string; labels: MapLabels; onClose: () => void }) {
  return (
    <CardShell title={title} onClose={onClose} closeLabel={labels.close}>
      <dl className="mt-3 text-sm">
        <Stat label={labels.typeLabel} value={labels.kinds[kind] ?? kind} />
      </dl>
    </CardShell>
  );
}
