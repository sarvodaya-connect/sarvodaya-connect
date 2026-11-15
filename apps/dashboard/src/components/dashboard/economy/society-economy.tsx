import Link from "next/link";

import type {
  Paged,
  ProductionRecord,
  ProductionRecordListItem,
  ProductionRecordRevision,
  SocietyBusiness,
  SocietyEconomicProfile,
} from "@sarvodaya-connect/api-contracts";

import { EmptyState } from "@/components/dashboard/data-states";
import { Pagination } from "@/components/dashboard/national/links";
import { Eyebrow } from "@/components/dashboard/national/parts";
import { Pill } from "@/components/dashboard/ui/pill";
import { formatDate, type Translator } from "@/i18n/translate";
import {
  BUSINESS_STATUS_TONE,
  ECONOMY_PAGE_SIZE,
  industryLabel,
  MEASUREMENT_TONE,
  measurementLabel,
  periodLabel,
  productLabel,
  quantityLabel,
  statusLabel,
  unitName,
  whenLabel,
} from "@/lib/economy-format";

import { RecordsTable } from "./economy-overview";

function BusinessCard({ business, t }: { business: SocietyBusiness; t: Translator }) {
  const updater = business.updatedBy ?? business.createdBy;
  return (
    <li className="flex h-full flex-col rounded-card border border-line bg-surface p-4" data-testid={`business-${business.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Eyebrow>{industryLabel(business.industry, t, business.otherIndustry)}</Eyebrow>
          <h3 className="text-[15px] font-bold text-ink">{business.name}</h3>
        </div>
        <Pill tone={BUSINESS_STATUS_TONE[business.status]}>{statusLabel(business.status, t)}</Pill>
      </div>
      {business.description && <p className="mt-1 text-[12px] text-ink-soft">{business.description}</p>}
      {business.status === "CLOSED" && business.closedAt && (
        <p className="mt-1 text-[11px] text-muted">
          {t("eco.business.closedSince", {
            date: formatDate(t.locale, new Date(business.closedAt), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" }),
          })}
        </p>
      )}
      <p className="mt-3 text-[11px] font-semibold text-ink-soft">{t("eco.business.outputs")}</p>
      {business.outputs.length === 0 ? (
        <p className="text-[11.5px] text-muted">{t("eco.business.noOutputs")}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {business.outputs.map((output) => (
            <li
              className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] ${output.archivedAt ? "border-line text-muted" : "border-line bg-[#f4f5f1] text-ink"}`}
              key={output.id}
            >
              {productLabel(output.product, t, output.otherDescription)}
              <span className="text-muted">· {unitName(output.unit, t)}</span>
              {output.archivedAt && <span className="font-semibold">· {t("eco.business.archived")}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-3 text-[10.5px] text-muted">
        {t("eco.business.updated", { when: whenLabel(business.updatedAt, t), name: updater.displayName })}
      </p>
    </li>
  );
}

type Props = {
  profile: SocietyEconomicProfile;
  records: Paged<ProductionRecordListItem>;
  /** The overview the viewer came from, with its filters. */
  returnTo?: string;
  t: Translator;
};

/**
 * Issue #147, frame 1: the society record's Village Economic Profile. Read-only
 * on the dashboard: the Society Officer enters everything on the phone (#146).
 */
export function SocietyEconomy({ profile, records, returnTo, t }: Props) {
  const base = `/societies/${profile.society.id}/economy`;
  const keep = returnTo ? `?from=${encodeURIComponent(returnTo)}` : "";
  const totalPages = Math.max(1, Math.ceil(records.total / ECONOMY_PAGE_SIZE));
  return (
    <div className="mt-4 flex flex-col gap-4">
      {returnTo && (
        <Link className="w-fit text-[12px] font-semibold text-brand-forest underline" href={returnTo}>
          ← {t("eco.back")}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[17px] font-bold text-ink">{t("eco.title")}</h2>
        <Pill dot={false} tone="later">{t("eco.selfReported")}</Pill>
      </div>
      <p className="-mt-3 text-[12px] text-ink-soft">{t("eco.society.readOnly")}</p>

      <section aria-labelledby="economy-description" className="rounded-card border border-line bg-surface p-4">
        <h3 className="text-[13px] font-bold text-ink" id="economy-description">{t("eco.society.description")}</h3>
        <p className="mt-1 whitespace-pre-line text-[12px] text-ink">{profile.businessDescription ?? t("eco.society.noDescription")}</p>
        <p className="mt-1 text-[10.5px] text-muted">{t("eco.society.descriptionNote")}</p>
      </section>

      <section aria-labelledby="economy-businesses">
        <h3 className="text-[14px] font-bold text-ink" id="economy-businesses">{t("eco.society.businesses")}</h3>
        {profile.businesses.length === 0 ? (
          <div className="mt-2 rounded-card border border-line bg-surface">
            <EmptyState description={t("eco.society.noBusinessesBody")} title={t("eco.society.noBusinesses")} />
          </div>
        ) : (
          <ul className="mt-2 grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            {profile.businesses.map((business) => (
              <BusinessCard business={business} key={business.id} t={t} />
            ))}
          </ul>
        )}
      </section>

      {profile.businesses.length > 0 && (
        <section aria-labelledby="economy-records" className="min-w-0 rounded-card border border-line bg-surface p-4">
          <h3 className="text-[14px] font-bold text-ink" id="economy-records">{t("eco.table.title")}</h3>
          <p className="text-[11px] text-muted">
            {t("eco.records.note")} {t("eco.selfReportedNote")}
          </p>
          {records.items.length === 0 ? (
            <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-6 text-center text-[12px] text-muted">{t("eco.records.none")}</p>
          ) : (
            <div className="mt-3">
              <RecordsTable historyHref={(item) => `${base}/records/${item.id}${keep}`} items={records.items} t={t} />
            </div>
          )}
          <div className="mt-3 text-[12px] text-ink-soft">
            <Pagination
              href={(page) => `${base}?${new URLSearchParams({ ...(returnTo ? { from: returnTo } : {}), page: String(page) })}`}
              page={records.page}
              totalPages={totalPages}
            />
          </div>
        </section>
      )}
    </div>
  );
}

/** A production record and every saved version of it. */
export function RecordHistory({
  backHref,
  outputLabel,
  record,
  revisions,
  t,
}: {
  backHref: string;
  outputLabel: string;
  record: ProductionRecord;
  revisions: ProductionRecordRevision[];
  t: Translator;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <Link className="w-fit text-[12px] font-semibold text-brand-forest underline" href={backHref}>
        ← {t("eco.history.back")}
      </Link>
      <section aria-labelledby="history-heading" className="rounded-card border border-line bg-surface p-4">
        <Eyebrow>{outputLabel}</Eyebrow>
        <h2 className="text-[17px] font-bold text-ink" id="history-heading">{t("eco.history.title")}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
          <strong className="text-[18px] text-ink">{quantityLabel(record.quantity, record.unit, t)}</strong>
          <span>{periodLabel(record, t)}</span>
          <Pill tone={MEASUREMENT_TONE[record.measurement]}>{measurementLabel(record.measurement, t)}</Pill>
          <Pill dot={false} tone="later">{t("eco.selfReported")}</Pill>
        </p>
        <p className="mt-1 text-[11px] text-muted">{t("eco.history.note")}</p>
        <ol className="mt-3 divide-y divide-line-soft">
          {revisions.map((revision) => (
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-2" key={revision.version}>
              <span className="text-[12px] text-ink">
                <strong>{t("eco.history.version", { version: revision.version })}</strong> · {t(revision.change === "CREATED" ? "eco.history.CREATED" : "eco.history.CORRECTED")} ·{" "}
                <strong>{quantityLabel(revision.quantity, record.unit, t)}</strong>
                {(revision.source || revision.note) && (
                  <span className="block text-[11px] text-ink-soft">{[revision.source, revision.note].filter(Boolean).join(" · ")}</span>
                )}
              </span>
              <span className="text-[11px] text-muted">
                {t("eco.history.by", { name: revision.changedBy.displayName, when: whenLabel(revision.changedAt, t) })}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
