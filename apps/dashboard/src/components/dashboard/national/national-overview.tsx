import Link from "next/link";

import type { NationalOverview } from "@sarvodaya-connect/api-contracts";

import { Icon } from "@/components/dashboard/icon";
import { secondaryButtonClass } from "@/components/dashboard/data-states";
import { Pill } from "@/components/dashboard/ui/pill";
import { documentTypeLabel } from "@/components/dashboard/documents/document-labels";
import { MEMBERSHIP_LABELS, membershipNote } from "./membership-labels";

import { GRADE_STYLE, Panel, SampleBadge, SdgTile, Stat, YearLinks, count, lkrShort, share } from "./parts";
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
  const { societies } = overview;
  const rows = [
    { grade: "A" as const, note: "Economically and institutionally stronger" },
    { grade: "B" as const, note: "Medium-level societies" },
    { grade: "C" as const, note: "Need strengthening support" },
  ];
  return (
    <Panel eyebrow="Latest Shramadana society status" link={{ href: "/districts", label: "District view" }} title="Active societies by grade · as of today">
      <div className="flex flex-wrap items-center gap-5">
        <GradePyramid />
        <div className="min-w-[220px] flex-1">
          <p>
            <strong className="text-[30px] font-bold text-brand-forest">{count(societies.active)}</strong>
            <span className="ml-2 text-[13px] font-semibold text-ink">currently active</span>
          </p>
          <ul className="mt-1 divide-y divide-line-soft">
            {rows.map(({ grade, note }) => (
              <li className="flex items-center justify-between gap-3 py-2" key={grade}>
                <span className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 size-2 rounded-full" style={{ backgroundColor: GRADE_STYLE[grade].colour }} />
                  <span>
                    <span className="block text-[12px] font-semibold text-ink">Grade {GRADE_STYLE[grade].label}</span>
                    <span className="text-[10px] text-muted">{note}</span>
                  </span>
                </span>
                <strong className="text-[16px] text-ink">{count(societies.grades[grade])}</strong>
              </li>
            ))}
          </ul>
          {societies.grades.ungraded > 0 && <p className="text-[11px] text-muted">{count(societies.grades.ungraded)} active societies not graded yet</p>}
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-2 text-[11px] text-ink">
        <strong>{count(societies.registered)}</strong> registered · <strong>{count(societies.active)}</strong> active · {share(societies.active, societies.registered)}% of registered ·{" "}
        <strong>{count(societies.registeredNotActive)}</strong> registered but not active
      </p>
      <ul className="mt-3 grid auto-rows-fr gap-2 sm:grid-cols-2">
        <li><Stat label="Records not updated in 90+ days" tone="danger" value={count(societies.notUpdatedIn90Days)} /></li>
        <li><Stat label="Active societies without a map position" value={count(societies.withoutLocation)} /></li>
      </ul>
      <p className="mt-auto pt-3 text-[11px] text-muted">
        Grades change only with HQ approval ·{" "}
        <Link className="font-semibold text-brand-forest underline" href="/reviews">
          {societies.gradeRequestsWaiting} grade {societies.gradeRequestsWaiting === 1 ? "request" : "requests"} waiting
        </Link>
      </p>
    </Panel>
  );
}

function DistrictMap({ overview }: { overview: NationalOverview }) {
  const placed = overview.districts.filter((district) => district.active > 0 && district.latitude !== null && district.longitude !== null);
  return (
    <Panel eyebrow="Society map" link={{ href: "/map", label: "Map view" }} title="Active societies by district">
      <div className="flex flex-1 items-center justify-center rounded-lg bg-[#e9eef1] p-3">
        <svg aria-labelledby="district-map-title" className="h-auto max-h-[340px] w-full" role="img" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
          <title id="district-map-title">Active societies in each district</title>
          <IslandOutline />
          {placed.map((district) => {
            const { x, y } = project(district.latitude!, district.longitude!);
            return (
              <a aria-label={`${district.name}: ${district.active} active societies`} href={`/societies?districtId=${district.id}`} key={district.id}>
                <circle cx={x} cy={y} fill="#2e4a35" r={11} stroke="white" strokeWidth={1.5} />
                <text fill="white" fontSize="8" fontWeight="700" textAnchor="middle" x={x} y={y + 3}>{district.active}</text>
              </a>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-muted">Each number is the active societies in a district, placed at the average position of its societies. Click a district to see its societies.</p>
      {overview.societies.withoutLocation > 0 && (
        <Link className="mt-2 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[11px] text-ink hover:bg-brand-mint-soft" href="/reports?type=data-quality">
          <span><strong>{count(overview.societies.withoutLocation)} active societies</strong> have no map position yet</span>
          <span className="font-semibold text-brand-forest">View list ›</span>
        </Link>
      )}
    </Panel>
  );
}

function Membership({ overview }: { overview: NationalOverview }) {
  const { membership } = overview;
  return (
    <Panel eyebrow="Total membership" link={{ href: "/membership", label: "Membership" }} title="Female and male members">
      <p>
        <strong className="text-[30px] font-bold text-ink">{count(membership.total)}</strong>
        <span className="ml-2 text-[11px] text-muted">members in {count(overview.societies.active)} active societies</span>
      </p>
      <ul className="mt-2 grid auto-rows-fr grid-cols-2 gap-2">
        <li><Stat label={<><strong>Female</strong> · {share(membership.female, membership.total)}% of members</>} tone="female" value={count(membership.female)} /></li>
        <li><Stat label={<><strong>Male</strong> · {share(membership.male, membership.total)}% of members</>} tone="male" value={count(membership.male)} /></li>
      </ul>
      <table className="mt-4 w-full text-left text-[11px]">
        <caption className="pb-1 text-left text-[12px] font-bold text-ink">Membership categories</caption>
        <thead className="text-[10px] uppercase tracking-[0.06em] text-muted">
          <tr><th className="py-1 font-semibold" scope="col">Category</th><th className="py-1 text-right font-semibold" scope="col">Female</th><th className="py-1 text-right font-semibold" scope="col">Male</th><th className="py-1 text-right font-semibold" scope="col">Total</th></tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {membership.categories.map((row) => (
            <tr key={row.category}>
              <th className="py-1.5 font-semibold text-ink" scope="row">{MEMBERSHIP_LABELS[row.category] ?? row.category}</th>
              <td className="py-1.5 text-right text-[#7a3f96]">{count(row.female)}</td>
              <td className="py-1.5 text-right text-[#2f5590]">{count(row.male)}</td>
              <td className="py-1.5 text-right font-semibold text-ink">{count(row.total)}</td>
            </tr>
          ))}
          <tr className="font-bold"><th className="py-1.5 text-ink" scope="row">All members</th><td className="py-1.5 text-right text-[#7a3f96]">{count(membership.female)}</td><td className="py-1.5 text-right text-[#2f5590]">{count(membership.male)}</td><td className="py-1.5 text-right text-ink">{count(membership.total)}</td></tr>
        </tbody>
      </table>
      <p className="mt-auto pt-3 text-[11px] text-muted">{membershipNote(membership.year, membership.societiesReported, overview.societies.active)}</p>
    </Panel>
  );
}

function Activities({ overview }: { overview: NationalOverview }) {
  const { activities, financialYear } = overview;
  return (
    <Panel eyebrow="SDGs and dimensions" link={{ href: `/activities?year=${financialYear.startYear}`, label: "All 17 SDGs" }} title="Completed activities">
      <p><strong className="text-[30px] font-bold text-ink">{count(activities.completed)}</strong></p>
      <p className="text-[11px] text-muted">
        of {count(activities.planned)} planned activities completed — {share(activities.completed, activities.planned)}% · {financialYear.label}
      </p>
      <ul className="mt-3 grid auto-rows-fr grid-cols-3 gap-2">
        {activities.byDimension.map((row) => (
          <li className="flex h-full flex-col rounded-tile border border-line px-3 py-2" key={row.dimension}>
            <span className="text-[11px] text-muted">{row.dimension.charAt(0)}{row.dimension.slice(1).toLowerCase()}</span>
            <span className="text-[13px] text-ink"><strong className="text-[16px]">{count(row.completed)}</strong> of {count(row.planned)}</span>
            <span className="text-[10px] text-muted">completed</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between text-[12px] font-bold text-ink">
        UN SDGs ranked by completed activities <span className="text-[10px] font-normal text-muted">Top {activities.topSdgs.length} of 17</span>
      </p>
      {activities.topSdgs.length === 0 ? (
        <p className="mt-2 rounded-lg bg-[#f4f5f1] px-3 py-4 text-center text-[12px] text-muted">No completed activity with a UN SDG yet for {financialYear.label}.</p>
      ) : (
        <ol className="mt-2 grid auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-3">
          {activities.topSdgs.map((row, index) => <SdgTile completed={row.completed} key={row.sdg} rank={index + 1} sdg={row.sdg} />)}
        </ol>
      )}
      <p className="mt-auto pt-3 text-[11px] text-muted">Counts completed, SPC-approved activities linked to each SDG. An activity can have several SDGs. Equal counts are listed by SDG number.</p>
    </Panel>
  );
}

function Finance({ demo, overview }: { demo: boolean; overview: NationalOverview }) {
  const { finance, financialYear } = overview;
  return (
    <Panel eyebrow="Profit and expenses" title="Totals for the year">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-muted">Totals of the two yearly figures societies entered · {financialYear.label}</p>
        <SampleBadge demo={demo} label="Sample figures" />
      </div>
      <ul className="mt-3 grid auto-rows-fr grid-cols-2 gap-2">
        <li><Stat label={<>Total profit for the year<br />From {count(finance.societiesWithBoth)} active societies</>} tone="profit" value={lkrShort(finance.totalProfit)} /></li>
        <li><Stat label={<>Total expenses for the year<br />From {count(finance.societiesWithBoth)} active societies</>} tone="expenses" value={lkrShort(finance.totalExpenses)} /></li>
        <li><Stat label={`of ${count(finance.activeSocieties)} active societies submitted both figures — ${share(finance.societiesWithBoth, finance.activeSocieties)}%`} value={count(finance.societiesWithBoth)} /></li>
        <li>
          <Stat
            label={<>not submitted yet · <Link className="font-semibold text-brand-forest underline" href={`/societies?view=figures-not-added`}>View list</Link></>}
            value={count(finance.notSubmitted)}
          />
        </li>
      </ul>
      <p className="mt-auto flex gap-2 rounded-lg bg-[#f4f5f1] px-3 py-2 pt-2 text-[11px] text-ink">
        <Icon className="mt-0.5 size-3.5 shrink-0" name="help" />
        Only these two yearly totals are kept, with the audit report. Societies record no other financial details.
      </p>
    </Panel>
  );
}

function Documents({ overview }: { overview: NationalOverview }) {
  const { registrarDocuments: docs, financialYear } = overview;
  const audit = docs.byType.find((row) => row.documentType === "AUDIT_REPORT")!;
  const percent = share(audit.submitted, docs.activeSocieties);
  return (
    <Panel eyebrow="Audit and AGM" link={{ href: `/compliance?year=${financialYear.startYear}`, label: "Audits" }} title="Documents to the Registrar">
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full border-[6px] border-brand-forest text-[16px] font-bold text-ink">{percent}%</span>
        <p className="text-[12px] text-ink">
          <strong>{count(audit.submitted)} of {count(docs.activeSocieties)}</strong> active societies submitted an audit report for {financialYear.label}.
          <br />
          <span className="font-semibold text-[#a8312a]">{count(audit.missing)} missing</span>
          {docs.pastDue ? " · past the due date" : ` · due ${new Date(`${docs.auditReportDueOn}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`}
        </p>
      </div>
      <table className="mt-3 w-full text-left text-[11px]">
        <thead className="text-[10px] uppercase tracking-[0.06em] text-muted">
          <tr><th className="py-1 font-semibold" scope="col">Document · {financialYear.label}</th><th className="py-1 text-right font-semibold" scope="col">Submitted</th><th className="py-1 text-right font-semibold" scope="col">Missing</th></tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {docs.byType.map((row) => (
            <tr key={row.documentType}>
              <th className="py-1.5 font-normal text-ink" scope="row">{documentTypeLabel(row.documentType)}</th>
              <td className="py-1.5 text-right text-brand-forest">{count(row.submitted)}</td>
              <td className="py-1.5 text-right text-[#a8312a]">{count(row.missing)}</td>
            </tr>
          ))}
          <tr className="font-bold"><th className="py-1.5 text-ink" scope="row">All four documents</th><td className="py-1.5 text-right text-brand-forest">{count(docs.allFour)}</td><td className="py-1.5 text-right text-[#a8312a]">{count(Math.max(0, docs.activeSocieties - docs.allFour))}</td></tr>
        </tbody>
      </table>
      <p className="mt-auto pt-3 text-[11px] text-muted">Out of {count(docs.activeSocieties)} active societies. Audits are certified by an auditor registered under the Companies Act.</p>
    </Panel>
  );
}

function Incidents({ overview }: { overview: NationalOverview }) {
  const incidents = overview.incidents;
  return (
    <Panel eyebrow="Disaster and emergency" link={{ href: "/emergencies", label: "Disaster response" }} title="Active incidents and their status">
      {incidents.length === 0 ? (
        <p className="rounded-lg bg-[#f4f5f1] px-3 py-6 text-center text-[12px] text-muted">No open incidents. Any role can open one from the phone app.</p>
      ) : (
        <ul className="space-y-3">
          {incidents.map((incident) => (
            <li className="rounded-lg border border-[#f0cfcb] bg-[#fdf3f2] p-3" key={incident.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[13px] font-bold text-ink">
                  {incident.status === "ACTIVE" && <span className="rounded bg-[#a8312a] px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Live</span>}
                  {incident.title}
                </p>
                <Pill tone={incident.status === "ACTIVE" ? "overdue" : "fast-target"}>{incident.status === "ACTIVE" ? "Responding" : "Contained"}</Pill>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                {incident.districtName} District · opened {new Date(incident.activatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" })} · {incident.severity.toLowerCase()} severity
              </p>
              <ul className="mt-2 grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <li><Stat label="Societies in the area" value={count(incident.societiesInArea)} /></li>
                <li><Stat label="Assessed" value={count(incident.assessed)} /></li>
                <li><Stat label="Not yet assessed" tone="danger" value={count(Math.max(0, incident.societiesInArea - incident.assessed))} /></li>
                <li><Stat label={`Families · ${count(incident.peopleAffected)} people`} value={count(incident.householdsAffected)} /></li>
                <li><Stat label={`Response actions · ${count(incident.actionsCompleted)} delivered`} value={count(incident.actions)} /></li>
              </ul>
              <Link className={`${secondaryButtonClass} mt-3`} href="/emergencies">Open incident</Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-3 text-[11px] text-muted">Every role can open and close incidents and send assessments. Only HQ assigns response actions.</p>
    </Panel>
  );
}

/** V5 D02 National Dashboard: six sections from approved records. */
export function NationalOverviewView({ demo, overview, years }: { demo: boolean; overview: NationalOverview; years: number[] }) {
  const { financialYear } = overview;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
        <span className="text-[12px] font-semibold text-ink">Reporting period</span>
        <YearLinks current={financialYear.startYear} href={(year) => `/dashboard?year=${year}`} years={years} />
        <span className="text-[11px] text-muted">Grades, active societies and incidents are as of today. Yearly figures, audits and activities are for {financialYear.label}.</span>
        <SampleBadge demo={demo} label="Demonstration data · sample figures, not real" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SocietyStatus overview={overview} />
        <DistrictMap overview={overview} />
      </div>
      <h2 className="text-[16px] font-bold text-ink">Demographics <span className="text-[11px] font-normal text-muted">Members and activities</span></h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Membership overview={overview} />
        <Activities overview={overview} />
      </div>
      <h2 className="text-[16px] font-bold text-ink">Financial data <span className="text-[11px] font-normal text-muted">Yearly totals and audit documents</span></h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Finance demo={demo} overview={overview} />
        <Documents overview={overview} />
      </div>
      <h2 className="text-[16px] font-bold text-ink">Disaster &amp; emergency</h2>
      <Incidents overview={overview} />
    </div>
  );
}
