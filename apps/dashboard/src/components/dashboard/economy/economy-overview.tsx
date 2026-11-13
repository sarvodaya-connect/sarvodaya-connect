import Link from "next/link";

import type {
  EconomyFilterScope,
  Paged,
  ProductionRecordListItem,
  ProductionSummary,
  ProductionSummaryRow,
} from "@sarvodaya-connect/api-contracts";

import { EmptyState } from "@/components/dashboard/data-states";
import { Pagination } from "@/components/dashboard/national/links";
import { Breadcrumb, Eyebrow, PageTitle, SampleBadge } from "@/components/dashboard/national/parts";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import { Pill } from "@/components/dashboard/ui/pill";
import { formatDate, formatNumber, type Translator } from "@/i18n/translate";
import type { DashboardRole } from "@/lib/access";
import {
  ECONOMY_PAGE_SIZE,
  industryLabel,
  MEASUREMENT_TONE,
  measurementLabel,
  type OverviewFilters,
  overviewHref,
  periodLabel,
  productLabel,
  quantityLabel,
  unitName,
  whenLabel,
} from "@/lib/economy-format";

import { EconomyFilters } from "./economy-filters";

/** Who the figures cover: the same line as Programmes, plus HQ's national one. */
export function economyScopeLine(scope: EconomyFilterScope, t: Translator) {
  const district = scope.districts.map((row) => row.name).join(", ");
  switch (scope.kind) {
    case "NATIONAL":
      return t.plural("eco.scope.national", scope.societyCount);
    case "DISTRICT":
      return t.plural("prog.scopeDistrict", scope.societyCount, { district });
    case "ASSIGNED_AND_DISTRICT":
      if (scope.temporaryAccessEndsAt)
        return t("prog.scopeTemporary", {
          district,
          count: formatNumber(t.locale, scope.societyCount),
          time: formatDate(t.locale, new Date(scope.temporaryAccessEndsAt), {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Colombo",
          }),
        });
      return t.plural("prog.scopeAssigned", scope.societyCount);
    case "ASSIGNED":
      return t.plural("prog.scopeAssigned", scope.societyCount);
  }
}

function SummaryCard({ measurement, row, t }: { measurement: ProductionSummary["measurement"]; row: ProductionSummaryRow; t: Translator }) {
  const { coverage } = row;
  return (
    <li className="flex h-full flex-col rounded-card border border-line bg-surface p-4" data-testid={`summary-${row.product}`}>
      <Eyebrow>{t(measurement === "ACTUAL" ? "eco.card.eyebrow.ACTUAL" : "eco.card.eyebrow.ESTIMATED")}</Eyebrow>
      <h3 className="text-[15px] font-bold text-ink">{productLabel(row.product, t)}</h3>
      {row.reportedQuantity === null ? (
        <p className="mt-2 text-[15px] font-semibold text-muted">{t("eco.card.noReports")}</p>
      ) : (
        <p className="mt-2 text-[24px] font-bold leading-tight text-ink">{quantityLabel(row.reportedQuantity, row.unit, t)}</p>
      )}
      <p className="text-[11px] text-ink-soft">
        {t.plural("eco.card.fromSocieties", coverage.reportedSocieties)} · {t.plural("eco.card.businesses", row.contributingBusinesses)} ·{" "}
        {t("eco.inUnit", { unit: unitName(row.unit, t) })}
      </p>
      <div className="mt-3 space-y-0.5 border-t border-line-soft pt-2 text-[11px] text-ink-soft">
        <p className="font-semibold text-ink">
          {t("eco.coverage.reported", {
            reported: formatNumber(t.locale, coverage.reportedSocieties),
            eligible: formatNumber(t.locale, coverage.eligibleSocieties),
          })}
        </p>
        {coverage.zeroSocieties > 0 && <p>{t.plural("eco.coverage.zero", coverage.zeroSocieties)}</p>}
        {coverage.missingSocieties > 0 && <p className="text-warn-text">{t.plural("eco.coverage.missing", coverage.missingSocieties)}</p>}
      </div>
    </li>
  );
}

type Props = {
  filters: OverviewFilters;
  scope: EconomyFilterScope;
  /** Null when the filters do not make an exact period yet. */
  summary: ProductionSummary | null;
  records: Paged<ProductionRecordListItem> | null;
  periodProblem?: "CHOOSE_SEASON" | "INVALID";
  role: DashboardRole;
  demo: boolean;
  t: Translator;
};

/**
 * Issue #147: Production Overview for HQ, DM, DDM and SPC. One design for
 * every role; the API limits the figures to the viewer's societies and this
 * page only shows what it returns. Each product is its own card in its own
 * unit, and only one exact period and one measurement is ever totalled.
 */
export function EconomyOverview({ demo, filters, periodProblem, records, role, scope, summary, t }: Props) {
  const title = t("eco.title");
  const home = role === "HQ_ADMIN" ? undefined : role === "DISTRICT_MANAGER" ? t("nav.districtOverview") : t("nav.home");
  const period = summary ? periodLabel(summary.period, t) : null;
  const returnTo = overviewHref(filters);
  const totalPages = records ? Math.max(1, Math.ceil(records.total / ECONOMY_PAGE_SIZE)) : 1;
  const nothingRegistered = summary && summary.products.length === 0 && summary.otherOutputs.length === 0 && records?.total === 0;

  return (
    <>
      <Breadcrumb current={title} home={home} />
      <PageTitle
        actions={
          <>
            <Pill dot={false} tone="later">{t("eco.selfReported")}</Pill>
            <SampleBadge demo={demo} />
          </>
        }
        description={
          period
            ? t("eco.descriptionLine", { period, measurement: measurementLabel(filters.measurement, t) })
            : t("sub.economicProfile")
        }
        title={title}
      />
      <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-ink-soft" data-testid="economy-scope">
        <span className="font-semibold text-brand-forest">{t("prog.scopeLabel")}</span>
        {economyScopeLine(scope, t)}
      </p>
      <p className="mt-2 text-[11.5px] text-ink-soft">
        {t("eco.selfReportedNote")} {t("eco.notCapacity")}
      </p>

      <EconomyFilters filters={filters} scope={scope} />

      {periodProblem && (
        <p className="mt-3 rounded-lg border border-[#e8d28a] bg-warn-bg px-3 py-2 text-[12px] text-warn-text" role="status">
          {t(periodProblem === "CHOOSE_SEASON" ? "eco.chooseSeason" : "eco.periodInvalid")}
        </p>
      )}

      {summary && period && (
        <>
          <ul className="mt-3 space-y-1 rounded-lg bg-[#f4f5f1] px-3 py-2 text-[11.5px] text-ink-soft" role="note">
            <li>{t("eco.exactPeriod", { period })}</li>
            {summary.products.length > 1 && <li>{t("eco.noGrandTotal")}</li>}
            {filters.measurement === "ESTIMATED" && <li>{t("eco.estimateNote")}</li>}
          </ul>

          {nothingRegistered ? (
            <div className="mt-4 rounded-card border border-line bg-surface">
              <EmptyState description={t("eco.noProducts.body")} title={t("eco.noProducts.title")} />
            </div>
          ) : (
            <>
              {summary.products.length > 0 && (
                <ul aria-label={t(filters.measurement === "ACTUAL" ? "eco.card.eyebrow.ACTUAL" : "eco.card.eyebrow.ESTIMATED")} className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {summary.products.map((row) => (
                    <SummaryCard key={`${row.product}-${row.unit}`} measurement={summary.measurement} row={row} t={t} />
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted">{t("eco.coverage.help")}</p>
              <p className="mt-1 text-[11px] text-muted" data-testid="economy-freshness">
                {summary.lastUpdatedAt ? t("eco.lastUpdated", { when: whenLabel(summary.lastUpdatedAt, t) }) : t("eco.noFigures")}
              </p>

              {summary.otherOutputs.length > 0 && (
                <section aria-labelledby="other-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
                  <h2 className="text-[15px] font-bold text-ink" id="other-heading">{t("eco.other.title")}</h2>
                  <p className="text-[11px] text-muted">{t("eco.other.note")}</p>
                  <div className="mt-3">
                    <DataTable>
                      <Thead>
                        <tr>
                          <Th scope="col">{t("eco.col.product")}</Th>
                          <Th scope="col">{t("eco.col.society")}</Th>
                          <Th scope="col">{t("eco.col.business")}</Th>
                          <Th className="text-right" scope="col">{t("eco.col.quantity")}</Th>
                        </tr>
                      </Thead>
                      <Tbody>
                        {summary.otherOutputs.map((row) => (
                          <Tr key={row.outputId}>
                            <Td className="font-semibold text-ink">{row.description}</Td>
                            <Td className="text-ink-soft">{row.society.name}</Td>
                            <Td className="text-ink-soft">{row.businessName}</Td>
                            <Td className="text-right text-ink">{quantityLabel(row.quantity, row.unit, t)}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </DataTable>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {records && !nothingRegistered && (
        <section aria-labelledby="records-heading" className="mt-4 min-w-0 rounded-card border border-line bg-surface p-4">
          <h2 className="text-[15px] font-bold text-ink" id="records-heading">{t("eco.table.title")}</h2>
          <p className="text-[11px] text-muted">{t("eco.table.note")}</p>
          {records.items.length === 0 ? (
            <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-6 text-center text-[12px] text-muted">{t("eco.noFigures")}</p>
          ) : (
            <div className="mt-3">
              <RecordsTable items={records.items} returnTo={returnTo} showSociety t={t} />
            </div>
          )}
          <div className="mt-3 text-[12px] text-ink-soft">
            <Pagination href={(page) => overviewHref(filters, { page })} page={records.page} totalPages={totalPages} />
          </div>
        </section>
      )}
    </>
  );
}

/** The records table, shared with the society view. */
export function RecordsTable({
  historyHref,
  items,
  returnTo,
  showSociety,
  t,
}: {
  items: ProductionRecordListItem[];
  /** The society view links each record to its history. */
  historyHref?: (item: ProductionRecordListItem) => string;
  returnTo?: string;
  showSociety?: boolean;
  t: Translator;
}) {
  return (
    <DataTable>
      <Thead>
        <tr>
          {showSociety && <Th scope="col">{t("eco.col.society")}</Th>}
          <Th scope="col">{t("eco.col.business")}</Th>
          <Th scope="col">{t("eco.col.product")}</Th>
          <Th className="text-right" scope="col">{t("eco.col.quantity")}</Th>
          <Th scope="col">{t("eco.col.period")}</Th>
          <Th scope="col">{t("eco.col.measurement")}</Th>
          <Th scope="col">{t("eco.col.updated")}</Th>
          {!showSociety && <Th scope="col">{t("eco.col.source")}</Th>}
          {historyHref && <Th scope="col"><span className="sr-only">{t("eco.history.link")}</span></Th>}
        </tr>
      </Thead>
      <Tbody>
        {items.map((item) => (
          <Tr key={item.id}>
            {showSociety && (
              <Td>
                <Link
                  className="font-semibold text-ink underline-offset-2 hover:underline"
                  href={`/societies/${item.society.id}/economy${returnTo ? `?from=${encodeURIComponent(returnTo)}` : ""}`}
                >
                  {item.society.name}
                </Link>
              </Td>
            )}
            <Td className="text-ink-soft">{item.business.name}</Td>
            <Td className="text-ink-soft">
              {industryLabel(item.business.industry, t, item.business.otherIndustry)} · {productLabel(item.product, t, item.otherDescription)}
            </Td>
            <Td className="whitespace-nowrap text-right font-semibold text-ink">{quantityLabel(item.quantity, item.unit, t)}</Td>
            <Td className="text-ink-soft">{periodLabel(item, t)}</Td>
            <Td>
              <Pill tone={MEASUREMENT_TONE[item.measurement]}>{measurementLabel(item.measurement, t)}</Pill>
            </Td>
            <Td className="text-ink-soft">
              {whenLabel(item.updatedAt, t)}
              {item.version > 1 && <span className="ml-1 text-[10.5px] font-semibold text-warn-text">· {t("eco.corrected")}</span>}
            </Td>
            {!showSociety && <Td className="text-ink-soft">{[item.source, item.note].filter(Boolean).join(" · ") || "—"}</Td>}
            {historyHref && (
              <Td>
                <Link className="font-semibold text-brand-forest underline" href={historyHref(item)}>
                  {t("eco.history.link")}
                </Link>
              </Td>
            )}
          </Tr>
        ))}
      </Tbody>
    </DataTable>
  );
}
