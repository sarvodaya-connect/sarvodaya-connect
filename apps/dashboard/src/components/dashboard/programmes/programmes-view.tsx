import Link from "next/link";
import type { NationalProgrammes, ScopedProgrammes } from "@sarvodaya-connect/api-contracts";

import { EmptyState, primaryButtonClass } from "@/components/dashboard/data-states";
import { Breadcrumb, PageTitle, SampleBadge } from "@/components/dashboard/national/parts";
import { YearLinks } from "@/components/dashboard/national/links";
import { share } from "@/components/dashboard/national/format";
import { SdgChips } from "@/components/dashboard/sdg/sdg-chip";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import type { MessageKey } from "@/i18n/messages/en";
import { formatDate, formatNumber, type Translator } from "@/i18n/translate";
import type { DashboardRole } from "@/lib/access";
import { selectableProgrammeYears } from "@/lib/activity-format";
import { sdgIconPath } from "@/lib/sdg";
import { SARVODAYA_SECTORS } from "@/lib/v5-constants";

const DIMENSION_COLOURS = { SOCIAL: "#c0392b", ECONOMIC: "#2f5590", GOVERNANCE: "#7a3f96" } as const;

/** A stored sector in the reader's language; one the app does not know stays as stored. */
export function sectorLabel(sector: string, t: Translator) {
  const index = SARVODAYA_SECTORS.indexOf(sector as (typeof SARVODAYA_SECTORS)[number]);
  return index < 0 ? sector : t(`sector.${index + 1}` as MessageKey);
}

export const sdgLabel = (sdg: number, t: Translator) => (sdg >= 1 && sdg <= 17 ? t(`sdg.${sdg}` as MessageKey) : t("prog.sdgNumber", { number: sdg }));

function approvedWhen(value: string, t: Translator, now = new Date()) {
  const date = new Date(value);
  const options = { day: "numeric", month: "short", timeZone: "Asia/Colombo" } as const;
  const day = formatDate(t.locale, date, options);
  return day === formatDate(t.locale, now, options) && date.getFullYear() === now.getFullYear() ? t("prog.today") : day;
}

/**
 * Issue #131: an approved activity whose month has not ended yet. It is in the
 * planned totals but not the completed ones, so the page says so rather than
 * looking as if the figures leave it out.
 */
function NotCompletedYet({ month, t, year }: { month?: number; t: Translator; year: number }) {
  const when = month ? formatDate(t.locale, new Date(Date.UTC(year, month - 1, 15)), { month: "short", year: "numeric", timeZone: "UTC" }) : String(year);
  return (
    <span className="mt-1 block w-fit rounded-full bg-warn-bg px-2 py-0.5 text-[10.5px] font-semibold text-warn-text" title={t("prog.notCompletedHelp")}>
      {t("prog.notCompletedYet", { when })}
    </span>
  );
}

/** Who the figures cover: the line under the title for a DM, DDM or SPC. */
export function scopeLine(scope: ScopedProgrammes["scope"], t: Translator) {
  const district = scope.districts.map((row) => row.name).join(", ");
  if (scope.kind === "DISTRICT") return t.plural("prog.scopeDistrict", scope.societies, { district });
  if (scope.kind === "ASSIGNED_AND_DISTRICT" && scope.temporaryAccessEndsAt)
    return t("prog.scopeTemporary", {
      district,
      count: formatNumber(t.locale, scope.societies),
      time: formatDate(t.locale, new Date(scope.temporaryAccessEndsAt), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" }),
    });
  return t.plural("prog.scopeAssigned", scope.societies);
}

type Props = {
  programmes: NationalProgrammes | ScopedProgrammes;
  role: DashboardRole;
  t: Translator;
  demo: boolean;
  activityId?: string;
};

/**
 * V5 D07 Programmes & Activities: done against planned from SPC-approved
 * activities, by the 10 sectors, UN SDGs and dimension. HQ sees the nation;
 * a DM, DDM or SPC sees the same page over the societies the API lets them
 * count (issue #117), with a line saying which.
 */
export function ProgrammesView({ programmes, role, t, demo, activityId }: Props) {
  const n = (value: number) => formatNumber(t.locale, value);
  const { financialYear } = programmes;
  const scope = "scope" in programmes ? programmes.scope : null;
  const sectors = SARVODAYA_SECTORS.map((sector, index) => {
    const row = programmes.sectors.find((entry) => entry.sector === sector);
    return { number: index + 1, sector, planned: row?.planned ?? 0, completed: row?.completed ?? 0, societies: row?.societies ?? 0 };
  });
  const selected = programmes.recent.find((row) => row.id === activityId) ?? programmes.recent[0];
  const title = t("page.programmesActivities");
  const home = role === "HQ_ADMIN" ? undefined : role === "DISTRICT_MANAGER" ? t("nav.districtOverview") : t("nav.home");
  const noSocieties = scope !== null && scope.societies === 0;

  return (
    <>
      <Breadcrumb current={title} home={home} />
      <PageTitle
        actions={
          <>
            <YearLinks current={financialYear.startYear} href={(value) => `/activities?year=${value}`} years={selectableProgrammeYears()} />
            <SampleBadge demo={demo} label={t("prog.demoBadge", { year: financialYear.label })} />
          </>
        }
        description={t("prog.summary", { completed: n(programmes.completed), planned: n(programmes.planned), year: financialYear.label })}
        title={title}
      />
      {financialYear.inProgress && (
        <p className="mt-2 rounded-lg border border-[#e8d28a] bg-warn-bg px-3 py-2 text-[12px] text-warn-text" role="note">
          {t("prog.inProgress", { year: financialYear.label })}
        </p>
      )}
      {scope && (
        <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-ink-soft" data-testid="programme-scope">
          <span className="font-semibold text-brand-forest">{t("prog.scopeLabel")}</span>
          {scopeLine(scope, t)}
        </p>
      )}

      {noSocieties ? (
        <div className="mt-4 rounded-card border border-line bg-surface">
          <EmptyState description={t("prog.noSocietiesBody")} title={t("prog.noSocietiesTitle")} />
        </div>
      ) : (
        scope &&
        programmes.planned === 0 && (
          <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-2 text-[12px] text-ink-soft" role="status">
            {t("prog.noActivitiesYear", { year: financialYear.label })}
          </p>
        )
      )}

      <ul aria-label={t("sub.tenSector")} className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sectors.map((row) => (
          <li className="flex h-full flex-col rounded-card border border-line bg-surface p-3" key={row.sector}>
            <span className="flex items-start gap-2 text-[12px] font-bold text-ink">
              <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-brand-forest text-[10px] text-white">{row.number}</span>
              {sectorLabel(row.sector, t)}
            </span>
            <span className="mt-2 text-[12px] text-ink">
              {t.rich("prog.sectorDone", { completed: <strong className="text-[20px]">{n(row.completed)}</strong>, planned: n(row.planned) })}
            </span>
            <span className="mt-auto text-[10px] text-muted">{t.plural("prog.societies", row.societies)}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="sdg-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("prog.sdgEyebrow")}</p>
        <h2 className="text-[15px] font-bold text-ink" id="sdg-heading">{t("prog.sdgTitle")}</h2>
        <p className="text-[11px] text-muted">{t("prog.sdgNote", { year: financialYear.label })}</p>
        <ol className="mt-3 grid gap-x-8 md:grid-cols-2">
          {programmes.sdgs.map((row, index) => (
            <li className="flex items-center gap-3 border-b border-line-soft py-2" key={row.sdg}>
              <span className="w-7 text-[11px] text-muted">{row.completed > 0 ? `#${index + 1}` : "—"}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- static official icon */}
              <img alt="" className="size-10 rounded" src={sdgIconPath(row.sdg)} />
              <span className="flex-1 text-[12px] text-ink"><strong>{t("prog.sdgNumber", { number: row.sdg })}</strong> · {sdgLabel(row.sdg, t)}</span>
              {row.completed > 0 ? (
                <span className="text-right"><strong className="block text-[15px] text-ink">{n(row.completed)}</strong><span className="text-[10px] text-muted">{t("n.completed")}</span></span>
              ) : (
                <span className="text-right text-[11px] text-muted"><strong className="block text-[15px] text-ink-soft">0</strong>{t("prog.noneCompleted")}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="recent-heading" className="min-w-0 rounded-card border border-line bg-surface p-4">
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("prog.approvedBySpcs")}</p>
          <h2 className="text-[15px] font-bold text-ink" id="recent-heading">{t("prog.recentTitle")}</h2>
          {programmes.recent.length === 0 ? (
            <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-6 text-center text-[12px] text-muted">{t("prog.noneApproved")}</p>
          ) : (
            <div className="mt-3">
              <DataTable>
                <Thead>
                  <tr>{(["prog.colActivity", "prog.colSector", "prog.colSociety", "prog.colApproved", "prog.colSdgs"] as const).map((heading) => <Th key={heading} scope="col">{t(heading)}</Th>)}</tr>
                </Thead>
                <Tbody>
                  {programmes.recent.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Link aria-current={row.id === selected?.id ? "true" : undefined} className="font-semibold text-ink underline-offset-2 hover:underline" href={`/activities?year=${financialYear.startYear}&activity=${row.id}`}>
                          {row.name}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">{row.sector ? sectorLabel(row.sector, t) : "—"}</Td>
                      <Td className="text-ink-soft">{row.society.name}</Td>
                      <Td className="text-ink-soft">
                        {approvedWhen(row.approvedAt, t)}
                        {row.completed === false && <NotCompletedYet month={row.month} t={t} year={row.year} />}
                      </Td>
                      <Td><SdgChips sdgs={row.sdgs} t={t} /></Td>
                    </Tr>
                  ))}
                </Tbody>
              </DataTable>
            </div>
          )}
        </section>
        <div className="flex flex-col gap-4">
          <section aria-labelledby="dimension-heading" className="rounded-card border border-line bg-surface p-4">
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("prog.byDimension")}</p>
            <h2 className="text-[15px] font-bold text-ink" id="dimension-heading">{t("prog.dimensionsTitle")}</h2>
            <ul className="mt-2 divide-y divide-line-soft text-[12px]">
              {programmes.byDimension.map((row) => (
                <li className="flex items-center justify-between gap-2 py-2" key={row.dimension}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: DIMENSION_COLOURS[row.dimension] }} />
                    {t(`dimension.${row.dimension}`)}
                  </span>
                  <span><strong className="text-ink">{n(row.completed)}</strong> / {n(row.planned)} · {share(row.completed, row.planned)}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted">{t("prog.dimensionNote")}</p>
          </section>
          {selected && (
            <section aria-labelledby="activity-detail" className="rounded-card border border-line bg-surface p-4">
              <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("prog.detail")}</p>
              <h2 className="text-[15px] font-bold text-ink" id="activity-detail">{selected.name}</h2>
              <p className="text-[11px] text-muted">{selected.society.name}{selected.datesLabel ? ` · ${selected.datesLabel} ${selected.year}` : ` · ${selected.year}`}</p>
              <ul className="mt-3 grid auto-rows-fr grid-cols-2 gap-2">
                <li className="flex h-full flex-col rounded-tile bg-[#f6eff9] px-3 py-2"><span className="text-[10px] text-[#7a3f96]">{t("prog.femaleMale")}</span><strong className="text-[16px] text-ink">{n(selected.femaleParticipants)} / {n(selected.maleParticipants)}</strong></li>
                <li className="flex h-full flex-col rounded-tile bg-[#eef6ef] px-3 py-2"><span className="text-[10px] text-brand-forest">{t("prog.households")}</span><strong className="text-[16px] text-ink">{n(selected.householdsBenefited)}</strong></li>
              </ul>
              <p className="mt-2 text-[11px] text-ink">{selected.sector ? sectorLabel(selected.sector, t) : t("prog.noSector")} · {t(`dimension.${selected.dimension}`)}</p>
              <div className="mt-2"><SdgChips sdgs={selected.sdgs} t={t} /></div>
              {selected.completed === false && <NotCompletedYet month={selected.month} t={t} year={selected.year} />}
              <p className="mt-2 text-[11px] text-muted">
                {selected.createdBy ? `${t("prog.createdBy", { name: selected.createdBy })} ` : ""}
                {t("prog.approvedBy", {
                  name: selected.approvedBy ?? t("prog.theSpc"),
                  when: approvedWhen(selected.approvedAt, t) === t("prog.today") ? t("prog.today") : t("prog.onDate", { date: approvedWhen(selected.approvedAt, t) }),
                })}
              </p>
              <Link className={`${primaryButtonClass} mt-3 w-full justify-center`} href={`/societies/${selected.society.id}/work-plan`}>{t("prog.openWorkPlan")}</Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
