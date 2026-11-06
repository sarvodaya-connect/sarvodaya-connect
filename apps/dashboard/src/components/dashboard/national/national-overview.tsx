"use client";

import Link from "next/link";

import type { NationalOverview } from "@sarvodaya-connect/api-contracts";

import { Icon } from "@/components/dashboard/icon";
import { secondaryButtonClass } from "@/components/dashboard/data-states";
import { Pill } from "@/components/dashboard/ui/pill";
import { SocietyPinsMap } from "@/components/dashboard/maps/society-pins-map";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages/en";
import { formatDate } from "@/i18n/translate";
import { mapboxToken } from "@/lib/mapbox";

import { useMembershipLabels } from "./membership-labels";

import { Panel, SampleBadge, SdgTile, Stat } from "./parts";
import { YearLinks } from "./links";
import { GRADE_STYLE, count, lkrShort, share } from "./format";
import { IslandOutline, MAP_HEIGHT, MAP_WIDTH, project } from "./sri-lanka";

/** Decorative A/B/C pyramid; the numbers next to it carry the meaning. */
function GradePyramid() {
  return (
    <svg aria-hidden="true" className="h-auto w-[150px] shrink-0" viewBox="0 0 150 120">
      <polygon fill={GRADE_STYLE.A.colour} points="75,4 95,38 55,38" />
      <polygon fill={GRADE_STYLE.B.colour} points="55,40 95,40 113,70 37,70" />
      <polygon fill={GRADE_STYLE.C.colour} points="36,72 114,72 146,116 4,116" />
      <text fill="white" fontSize="11" fontWeight="700" textAnchor="middle" x="75" y="31">A</text>
      <text fill="#3a2d00" fontSize="11" fontWeight="700" textAnchor="middle" x="75" y="60">B</text>
      <text fill="white" fontSize="11" fontWeight="700" textAnchor="middle" x="75" y="100">C</text>
    </svg>
  );
}

function SocietyStatus({ overview }: { overview: NationalOverview }) {
  const { t } = useI18n();
  const { societies } = overview;
  const rows = [
    { grade: "A" as const, note: t("n.noteA") },
    { grade: "B" as const, note: t("n.noteB") },
    { grade: "C" as const, note: t("n.noteC") },
  ];
  return (
    <Panel eyebrow={t("n.latestStatus")} link={{ href: "/districts", label: t("nav.districtView") }} title={t("n.byGradeToday")}>
      <div className="flex flex-wrap items-center gap-5">
        <GradePyramid />
        <div className="min-w-[220px] flex-1">
          <p>
            <strong className="text-[30px] font-bold text-brand-forest">{count(societies.active)}</strong>
            <span className="ml-2 text-[13px] font-semibold text-ink">{t("n.currentlyActive")}</span>
          </p>
          <ul className="mt-1 divide-y divide-line-soft">
            {rows.map(({ grade, note }) => (
              <li className="flex items-center justify-between gap-3 py-2" key={grade}>
                <span className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 size-2 rounded-full" style={{ backgroundColor: GRADE_STYLE[grade].colour }} />
                  <span>
                    <span className="block text-[12px] font-semibold text-ink">{t("n.gradeLabel", { label: t(`grade.${grade}`) })}</span>
                    <span className="text-[10px] text-muted">{note}</span>
                  </span>
                </span>
                <strong className="text-[16px] text-ink">{count(societies.grades[grade])}</strong>
              </li>
            ))}
          </ul>
          {societies.grades.ungraded > 0 && <p className="text-[11px] text-muted">{t("n.notGradedYet", { count: count(societies.grades.ungraded) })}</p>}
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-2 text-[11px] text-ink">
        {t.rich("n.statusLine", {
          registered: <strong>{count(societies.registered)}</strong>,
          active: <strong>{count(societies.active)}</strong>,
          percent: share(societies.active, societies.registered),
          notActive: <strong>{count(societies.registeredNotActive)}</strong>,
        })}
      </p>
      <ul className="mt-3 grid auto-rows-fr gap-2 sm:grid-cols-2">
        <li><Stat label={t("n.notUpdated90")} tone="danger" value={count(societies.notUpdatedIn90Days)} /></li>
        <li><Stat label={t("n.noMapPosition")} value={count(societies.withoutLocation)} /></li>
      </ul>
      <p className="mt-auto pt-3 text-[11px] text-muted">
        {t("n.gradesHqOnly")}{" "}
        <Link className="font-semibold text-brand-forest underline" href="/reviews">
          {t.plural("n.gradeRequestsWaiting", societies.gradeRequestsWaiting)}
        </Link>
      </p>
    </Panel>
  );
}

/** The drawn map: active societies per district. Shown when Mapbox is not set up. */
function DrawnDistrictMap({ overview }: { overview: NationalOverview }) {
  const { t } = useI18n();
  const placed = overview.districts.filter((district) => district.active > 0 && district.latitude !== null && district.longitude !== null);
  return (
    <>
      <div className="flex flex-1 items-center justify-center rounded-lg bg-[#e9eef1] p-3">
        <svg aria-labelledby="district-map-title" className="h-auto max-h-[340px] w-full" role="img" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
          <title id="district-map-title">{t("n.activeInEachDistrict")}</title>
          <IslandOutline />
          {placed.map((district) => {
            const { x, y } = project(district.latitude!, district.longitude!);
            return (
              <a aria-label={t("n.districtActive", { name: district.name, count: district.active })} href={`/societies?districtId=${district.id}`} key={district.id}>
                <circle cx={x} cy={y} fill="#2e4a35" r={11} stroke="white" strokeWidth={1.5} />
                <text fill="white" fontSize="8" fontWeight="700" textAnchor="middle" x={x} y={y + 3}>{district.active}</text>
              </a>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-muted">{t("n.mapExplain")}</p>
      <p className="mt-1 text-[11px] text-muted">{t("n.drawnMap")}</p>
    </>
  );
}

/** V5 D02 Society map: the Mapbox map of every society when a token is set, otherwise the drawn district map. */
function SocietyMapCard({ mapboxToken, overview }: { mapboxToken: string | null; overview: NationalOverview }) {
  const { t } = useI18n();
  return (
    <Panel eyebrow={t("n.societyMap")} link={{ href: "/map", label: t("nav.mapView") }} title={mapboxToken ? t("n.societiesByGrade") : t("n.activeByDistrict")}>
      {mapboxToken ? <SocietyPinsMap token={mapboxToken} /> : <DrawnDistrictMap overview={overview} />}
      <Link className="mt-2 self-start text-[11px] font-semibold text-brand-forest underline-offset-2 hover:underline" href="/societies">
        {t("n.listView")}
      </Link>
      {overview.societies.withoutLocation > 0 && (
        <Link className="mt-2 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[11px] text-ink hover:bg-brand-mint-soft" href="/reports?type=data-quality">
          <span>{t.rich("n.noPositionLine", { societies: <strong>{t("n.activeSocietiesCount", { count: count(overview.societies.withoutLocation) })}</strong> })}</span>
          <span className="font-semibold text-brand-forest">{t("n.viewListArrow")}</span>
        </Link>
      )}
    </Panel>
  );
}

function Membership({ overview }: { overview: NationalOverview }) {
  const { t } = useI18n();
  const { label: membershipLabel, note: membershipNote } = useMembershipLabels();
  const { membership } = overview;
  return (
    <Panel eyebrow={t("n.totalMembership")} link={{ href: "/membership", label: t("nav.membership") }} title={t("n.femaleMale")}>
      <p>
        <strong className="text-[30px] font-bold text-ink">{count(membership.total)}</strong>
        <span className="ml-2 text-[11px] text-muted">{t("n.membersInActive", { count: count(overview.societies.active) })}</span>
      </p>
      <ul className="mt-2 grid auto-rows-fr grid-cols-2 gap-2">
        <li><Stat label={t.rich("n.femaleShare", { label: <strong>{t("n.female")}</strong>, percent: share(membership.female, membership.total) })} tone="female" value={count(membership.female)} /></li>
        <li><Stat label={t.rich("n.femaleShare", { label: <strong>{t("n.male")}</strong>, percent: share(membership.male, membership.total) })} tone="male" value={count(membership.male)} /></li>
      </ul>
      <table className="mt-4 w-full text-left text-[11px]">
        <caption className="pb-1 text-left text-[12px] font-bold text-ink">{t("n.membershipCategories")}</caption>
        <thead className="text-[10px] tracking-[0.06em] text-muted">
          <tr><th className="py-1 font-semibold" scope="col">{t("n.category")}</th><th className="py-1 text-right font-semibold" scope="col">{t("n.female")}</th><th className="py-1 text-right font-semibold" scope="col">{t("n.male")}</th><th className="py-1 text-right font-semibold" scope="col">{t("n.total")}</th></tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {membership.categories.map((row) => (
            <tr key={row.category}>
              <th className="py-1.5 font-semibold text-ink" scope="row">{membershipLabel(row.category)}</th>
              <td className="py-1.5 text-right text-[#7a3f96]">{count(row.female)}</td>
              <td className="py-1.5 text-right text-[#2f5590]">{count(row.male)}</td>
              <td className="py-1.5 text-right font-semibold text-ink">{count(row.total)}</td>
            </tr>
          ))}
          <tr className="font-bold"><th className="py-1.5 text-ink" scope="row">{t("n.allMembers")}</th><td className="py-1.5 text-right text-[#7a3f96]">{count(membership.female)}</td><td className="py-1.5 text-right text-[#2f5590]">{count(membership.male)}</td><td className="py-1.5 text-right text-ink">{count(membership.total)}</td></tr>
        </tbody>
      </table>
      <p className="mt-auto pt-3 text-[11px] text-muted">{membershipNote(membership.year, membership.societiesReported, overview.societies.active)}</p>
    </Panel>
  );
}

function Activities({ overview }: { overview: NationalOverview }) {
  const { t } = useI18n();
  const { activities, financialYear } = overview;
  return (
    <Panel eyebrow={t("n.sdgsDimensions")} link={{ href: `/activities?year=${financialYear.startYear}`, label: t("n.all17") }} title={t("n.completedActivities")}>
      <p><strong className="text-[30px] font-bold text-ink">{count(activities.completed)}</strong></p>
      <p className="text-[11px] text-muted">
        {t("n.plannedLine", { planned: count(activities.planned), percent: share(activities.completed, activities.planned), year: financialYear.label })}
      </p>
      <ul className="mt-3 grid auto-rows-fr grid-cols-3 gap-2">
        {activities.byDimension.map((row) => (
          <li className="flex h-full flex-col rounded-tile border border-line px-3 py-2" key={row.dimension}>
            <span className="text-[11px] text-muted">{t(`dimension.${row.dimension}` as MessageKey)}</span>
            <span className="text-[13px] text-ink">{t.rich("n.ofPlanned", { completed: <strong className="text-[16px]">{count(row.completed)}</strong>, planned: count(row.planned) })}</span>
            <span className="text-[10px] text-muted">{t("n.completed")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between text-[12px] font-bold text-ink">
        {t("n.sdgsRanked")} <span className="text-[10px] font-normal text-muted">{t("n.topOf17", { count: activities.topSdgs.length })}</span>
      </p>
      {activities.topSdgs.length === 0 ? (
        <p className="mt-2 rounded-lg bg-[#f4f5f1] px-3 py-4 text-center text-[12px] text-muted">{t("n.noSdgYet", { year: financialYear.label })}</p>
      ) : (
        <ol className="mt-2 grid auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-3">
          {activities.topSdgs.map((row, index) => <SdgTile completed={row.completed} key={row.sdg} rank={index + 1} sdg={row.sdg} />)}
        </ol>
      )}
      <p className="mt-auto pt-3 text-[11px] text-muted">{t("n.sdgExplain")}</p>
    </Panel>
  );
}

function Finance({ demo, overview }: { demo: boolean; overview: NationalOverview }) {
  const { t } = useI18n();
  const { finance, financialYear } = overview;
  return (
    <Panel eyebrow={t("n.profitExpenses")} title={t("n.totalsYear")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-muted">{t("n.totalsLine", { year: financialYear.label })}</p>
        <SampleBadge demo={demo} label={t("n.sampleFigures")} />
      </div>
      <ul className="mt-3 grid auto-rows-fr grid-cols-2 gap-2">
        <li><Stat label={<>{t("n.totalProfit")}<br />{t("n.fromActive", { count: count(finance.societiesWithBoth) })}</>} tone="profit" value={lkrShort(finance.totalProfit)} /></li>
        <li><Stat label={<>{t("n.totalExpenses")}<br />{t("n.fromActive", { count: count(finance.societiesWithBoth) })}</>} tone="expenses" value={lkrShort(finance.totalExpenses)} /></li>
        <li><Stat label={t("n.submittedBoth", { count: count(finance.activeSocieties), percent: share(finance.societiesWithBoth, finance.activeSocieties) })} value={count(finance.societiesWithBoth)} /></li>
        <li>
          <Stat
            label={<>{t("n.notSubmittedYet")} <Link className="font-semibold text-brand-forest underline" href={`/societies?view=figures-not-added`}>{t("n.viewList")}</Link></>}
            value={count(finance.notSubmitted)}
          />
        </li>
      </ul>
      <p className="mt-auto flex gap-2 rounded-lg bg-[#f4f5f1] px-3 py-2 pt-2 text-[11px] text-ink">
        <Icon className="mt-0.5 size-3.5 shrink-0" name="help" />
        {t("n.onlyTwoTotals")}
      </p>
    </Panel>
  );
}

function Documents({ overview }: { overview: NationalOverview }) {
  const { locale, t } = useI18n();
  const { registrarDocuments: docs, financialYear } = overview;
  const audit = docs.byType.find((row) => row.documentType === "AUDIT_REPORT")!;
  const percent = share(audit.submitted, docs.activeSocieties);
  return (
    <Panel eyebrow={t("n.auditAgm")} link={{ href: `/compliance?year=${financialYear.startYear}`, label: t("nav.audits") }} title={t("n.docsRegistrar")}>
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-[6px] border-brand-forest text-[16px] font-bold text-ink">{percent}%</span>
        <p className="text-[12px] text-ink">
          {t.rich("n.auditLine", { count: <strong>{t("n.xOfY", { x: count(audit.submitted), y: count(docs.activeSocieties) })}</strong>, year: financialYear.label })}
          <br />
          <span className="font-semibold text-[#a8312a]">{t("n.missingCount", { count: count(audit.missing) })}</span>
          {docs.pastDue ? t("n.pastDue") : t("n.dueOn", { date: formatDate(locale, new Date(`${docs.auditReportDueOn}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) })}
        </p>
      </div>
      <table className="mt-3 w-full text-left text-[11px]">
        <thead className="text-[10px] tracking-[0.06em] text-muted">
          <tr><th className="py-1 font-semibold" scope="col">{t("n.documentYear", { year: financialYear.label })}</th><th className="py-1 text-right font-semibold" scope="col">{t("n.submitted")}</th><th className="py-1 text-right font-semibold" scope="col">{t("n.missing")}</th></tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {docs.byType.map((row) => (
            <tr key={row.documentType}>
              <th className="py-1.5 font-normal text-ink" scope="row">{t(`doc.${row.documentType}` as MessageKey)}</th>
              <td className="py-1.5 text-right text-brand-forest">{count(row.submitted)}</td>
              <td className="py-1.5 text-right text-[#a8312a]">{count(row.missing)}</td>
            </tr>
          ))}
          <tr className="font-bold"><th className="py-1.5 text-ink" scope="row">{t("n.allFour")}</th><td className="py-1.5 text-right text-brand-forest">{count(docs.allFour)}</td><td className="py-1.5 text-right text-[#a8312a]">{count(Math.max(0, docs.activeSocieties - docs.allFour))}</td></tr>
        </tbody>
      </table>
      <p className="mt-auto pt-3 text-[11px] text-muted">{t("n.outOf", { count: count(docs.activeSocieties) })}</p>
    </Panel>
  );
}

function Incidents({ overview }: { overview: NationalOverview }) {
  const { locale, t } = useI18n();
  const incidents = overview.incidents;
  return (
    <Panel eyebrow={t("nav.disasterEmergency")} link={{ href: "/emergencies", label: t("nav.disasterResponse") }} title={t("n.activeIncidents")}>
      {incidents.length === 0 ? (
        <p className="rounded-lg bg-[#f4f5f1] px-3 py-6 text-center text-[12px] text-muted">{t("n.noIncidents")}</p>
      ) : (
        <ul className="space-y-3">
          {incidents.map((incident) => (
            <li className="rounded-lg border border-[#f0cfcb] bg-[#fdf3f2] p-3" key={incident.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
                  {incident.status === "ACTIVE" && <span className="rounded bg-[#a8312a] px-1.5 py-0.5 text-[9px] font-bold text-white">{t("n.live")}</span>}
                  {incident.title}
                </p>
                <Pill tone={incident.status === "ACTIVE" ? "overdue" : "fast-target"}>{incident.status === "ACTIVE" ? t("n.responding") : t("n.contained")}</Pill>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                {t("n.incidentMeta", { district: incident.districtName, date: formatDate(locale, new Date(incident.activatedAt), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" }), severity: t(`severity.${incident.severity}` as MessageKey) })}
              </p>
              <ul className="mt-2 grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <li><Stat label={t("n.inArea")} value={count(incident.societiesInArea)} /></li>
                <li><Stat label={t("n.assessed")} value={count(incident.assessed)} /></li>
                <li><Stat label={t("n.notAssessed")} tone="danger" value={count(Math.max(0, incident.societiesInArea - incident.assessed))} /></li>
                <li><Stat label={t("n.familiesPeople", { count: count(incident.peopleAffected) })} value={count(incident.householdsAffected)} /></li>
                <li><Stat label={t("n.actionsDelivered", { count: count(incident.actionsCompleted) })} value={count(incident.actions)} /></li>
              </ul>
              <Link className={`${secondaryButtonClass} mt-3`} href="/emergencies">{t("n.openIncident")}</Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-3 text-[11px] text-muted">{t("n.everyRole")}</p>
    </Panel>
  );
}

/** V5 D02 National Dashboard: six sections from approved records. */
export function NationalOverviewView({ demo, overview, years }: { demo: boolean; overview: NationalOverview; years: number[] }) {
  const { t } = useI18n();
  const { financialYear } = overview;
  const [askBefore, askAfter] = t("shell.ask").split("{brand}");
  return (
    <div className="space-y-5">
      <form action="/sarvoai" className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3" method="get" role="search">
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-brand-forest text-[#f3c44e]">
          <Icon className="size-4" name="sparkle" />
        </span>
        <span className="min-w-[160px]">
          <strong className="block text-[13px] text-ink">{askBefore}Sarvo<span className="text-[#f0a040]">AI</span>{askAfter}</strong>
          <span className="text-[11px] text-muted">{t("n.hqOnlyAnswers")}</span>
        </span>
        <label className="sr-only" htmlFor="ask-sarvoai">{t("n.askQuestion")}</label>
        <input
          className="min-w-[200px] flex-1 rounded-button border border-line bg-[#f7f8f5] px-3 py-2 text-[12px] text-ink"
          id="ask-sarvoai"
          maxLength={500}
          minLength={3}
          name="q"
          placeholder={t("n.askPlaceholder")}
          required
        />
        <button className="rounded-button bg-brand-forest px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#174f34]" type="submit">{t("n.ask")}</button>
      </form>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
        <span className="text-[12px] font-semibold text-ink">{t("n.reportingPeriod")}</span>
        <YearLinks current={financialYear.startYear} href={(year) => `/dashboard?year=${year}`} years={years} />
        <span className="text-[11px] text-muted">{t("n.periodNote", { year: financialYear.label })}</span>
        <SampleBadge demo={demo} label={t("n.demoSample")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SocietyStatus overview={overview} />
        <SocietyMapCard mapboxToken={mapboxToken()} overview={overview} />
      </div>
      <h2 className="text-[16px] font-bold text-ink">{t("n.demographics")} <span className="text-[11px] font-normal text-muted">{t("n.membersActivities")}</span></h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Membership overview={overview} />
        <Activities overview={overview} />
      </div>
      <h2 className="text-[16px] font-bold text-ink">{t("n.financialData")} <span className="text-[11px] font-normal text-muted">{t("n.yearlyAudit")}</span></h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Finance demo={demo} overview={overview} />
        <Documents overview={overview} />
      </div>
      <h2 className="text-[16px] font-bold text-ink">{t("nav.disasterEmergency")}</h2>
      <Incidents overview={overview} />
    </div>
  );
}
