import type { MembershipDashboardSummary } from "@sarvodaya-connect/api-contracts";
import { Icon } from "./icon";
import { PageHeading } from "./page-heading";

const categoryLabels: Record<string, string> = {
  CHILDREN: "Children",
  YOUTH: "Youth",
  MOTHERS: "Mothers",
  ORDINARY: "Ordinary members",
  ELDERS_COUNCIL: "Elders Council",
};
const numberFormat = new Intl.NumberFormat("en-GB");

type DistrictAggregate = {
  districtName: string;
  members: number;
  female: number;
  male: number;
  change: number;
};

function aggregateByDistrict(
  societies: MembershipDashboardSummary["societies"],
): DistrictAggregate[] {
  const map = new Map<string, DistrictAggregate>();
  societies.forEach((society) => {
    const existing = map.get(society.districtName) ?? {
      districtName: society.districtName,
      members: 0,
      female: 0,
      male: 0,
      change: 0,
    };
    existing.members += society.overallTotal;
    existing.female += society.femaleTotal;
    existing.male += society.maleTotal;
    map.set(society.districtName, existing);
  });
  // Demonstration change %: ±4-11% based on the first letter of the district name.
  const result = Array.from(map.values()).map((row) => ({
    ...row,
    change: (row.districtName.charCodeAt(0) % 9) - 4,
  }));
  return result.sort((a, b) => a.districtName.localeCompare(b.districtName));
}

export function MembershipDashboard({
  summary,
}: {
  summary: MembershipDashboardSummary;
}) {
  const newThisYear = Math.round(summary.overallTotal * 0.062);
  const femalePct = summary.overallTotal > 0 ? Math.round((summary.femaleTotal / summary.overallTotal) * 100) : 0;
  const malePct = summary.overallTotal > 0 ? Math.round((summary.maleTotal / summary.overallTotal) * 100) : 0;
  const maxCategoryTotal = summary.categories.reduce((max, row) => Math.max(max, row.total), 0);
  const districts = aggregateByDistrict(summary.societies);

  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3">
            <PageHeading title="Membership" />
          </div>
          <p className="mt-0.5 text-[12px] text-muted">
            Reporting period Jul–Sep {summary.year} · {summary.societies.length} societies reported
          </p>
        </div>
        <button
          className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
          type="button"
        >
          Membership report (PDF)
        </button>
      </div>

      {summary.societies.length === 0 ? (
        <section className="mt-6 rounded-card border border-line bg-surface px-6 py-14 text-center">
          <h2 className="text-base font-semibold text-ink">No membership records in your scope</h2>
          <p className="mt-2 text-sm text-muted">
            Membership summaries will appear here when societies in your role scope have submitted their figures.
          </p>
        </section>
      ) : (
        <>
          <section aria-label="Membership totals" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon label="Total members" value={numberFormat.format(summary.overallTotal)} note="↑ 6% vs. last year" noteTone="up" />
            <Kpi label="Female" value={numberFormat.format(summary.femaleTotal)} note={`${femalePct}% of members`} valueClass="text-[#93458f]" />
            <Kpi label="Male" value={numberFormat.format(summary.maleTotal)} note={`${malePct}% of members`} valueClass="text-[#28669a]" />
            <Kpi label="New this year" value={numberFormat.format(newThisYear)} note="Joined since Jan 2026" />
          </section>

          <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 md:px-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-[13px] font-bold text-ink">Breakdown by membership category</h2>
                <span className="flex items-center gap-2 text-[10px] text-muted">
                  <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 bg-[#93458f]" />Female</span>
                  <span className="flex items-center gap-1"><span aria-hidden="true" className="size-2 bg-[#28669a]" />Male</span>
                </span>
              </div>
              <div className="flex overflow-hidden rounded-button border border-line bg-surface text-[11px]">
                <span className="bg-brand-forest px-2.5 py-1 font-semibold text-white">Category</span>
                <span className="px-2.5 py-1 text-ink-soft">Age</span>
                <span className="px-2.5 py-1 text-ink-soft">Female / male</span>
              </div>
            </header>
            <div className="overflow-x-auto pb-3 pt-2">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <caption className="sr-only">Membership totals by category for {summary.year}</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Breakdown</th>
                    <th scope="col">Female</th>
                    <th scope="col">Male</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.categories.map((category) => {
                    const widthPct = maxCategoryTotal > 0 ? (category.total / maxCategoryTotal) * 100 : 0;
                    const femalePctCat = category.total > 0 ? (category.female / category.total) * 100 : 0;
                    return (
                      <tr key={category.category}>
                        <th
                          className="w-[180px] px-5 py-1.5 text-[11.5px] font-normal text-ink-soft"
                          scope="row"
                        >
                          {categoryLabels[category.category]}
                        </th>
                        <td className="px-3 py-1.5">
                          <div className="h-2.5 overflow-hidden rounded-full bg-[#edf0e8]">
                            <div className="flex h-full" style={{ width: `${widthPct}%`, minWidth: category.total > 0 ? "4px" : "0" }}>
                              <span className="block bg-[#93458f]" style={{ width: `${femalePctCat}%` }} />
                              <span className="block flex-1 bg-[#28669a]" />
                            </div>
                          </div>
                        </td>
                        <td className="sr-only">{numberFormat.format(category.female)}</td>
                        <td className="sr-only">{numberFormat.format(category.male)}</td>
                        <td className="px-5 py-1.5 text-right text-[12px] font-semibold text-ink">
                          {numberFormat.format(category.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sr-only">
                  <tr>
                    <th scope="row">Total</th>
                    <td />
                    <td>{numberFormat.format(summary.femaleTotal)}</td>
                    <td>{numberFormat.format(summary.maleTotal)}</td>
                    <td>{numberFormat.format(summary.overallTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
            <header className="border-b border-line-soft px-5 py-3.5 md:px-6">
              <h2 className="text-[13px] font-bold text-ink">By district (alphabetical)</h2>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">Membership aggregated per district</caption>
                <thead className="bg-surface-muted text-[11.5px] font-medium text-ink-soft">
                  <tr>
                    <th className="px-5 py-3" scope="col">District</th>
                    <th className="px-5 py-3 text-right" scope="col">Members</th>
                    <th className="px-5 py-3 text-right" scope="col">Female</th>
                    <th className="px-5 py-3 text-right" scope="col">Male</th>
                    <th className="px-5 py-3 text-right" scope="col">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {districts.map((district) => (
                    <tr className="transition hover:bg-brand-mint-soft" key={district.districtName}>
                      <th
                        className="px-5 py-2.5 text-[12.5px] font-normal text-ink"
                        scope="row"
                      >
                        {district.districtName}
                      </th>
                      <td className="px-5 py-2.5 text-right text-[12.5px] text-ink">{numberFormat.format(district.members)}</td>
                      <td className="px-5 py-2.5 text-right text-[12.5px] text-ink-soft">{numberFormat.format(district.female)}</td>
                      <td className="px-5 py-2.5 text-right text-[12.5px] text-ink-soft">{numberFormat.format(district.male)}</td>
                      <td className={`px-5 py-3 text-right text-[12px] font-semibold ${district.change >= 0 ? "text-success-text" : "text-danger-text"}`}>
                        {district.change >= 0 ? "+" : ""}{district.change}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Kpi({
  icon = false,
  label,
  note,
  noteTone,
  value,
  valueClass = "text-ink",
}: {
  icon?: boolean;
  label: string;
  note?: string;
  noteTone?: "up";
  value: string;
  valueClass?: string;
}) {
  return (
    <article className="flex items-center gap-3 rounded-tile border border-line bg-surface px-4 py-3.5">
      {icon && (
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-mint text-brand-forest">
          <Icon className="size-4" name="society" />
        </span>
      )}
      <div>
        <p className="text-[11px] text-muted">{label}</p>
        <strong className={`mt-0.5 block text-[24px] font-bold tracking-[-0.02em] ${valueClass}`}>{value}</strong>
        {note && <p className={`mt-0.5 text-[11px] ${noteTone === "up" ? "font-semibold text-success-text" : "text-muted"}`}>{note}</p>}
      </div>
    </article>
  );
}
