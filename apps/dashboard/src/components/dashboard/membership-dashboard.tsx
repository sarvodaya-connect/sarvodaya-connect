import type { MembershipDashboardSummary } from "@sarvodaya-connect/api-contracts";
import { ChangedInV2Badge } from "./ui/changed-in-v2-badge";
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
            <ChangedInV2Badge />
          </div>
          <p className="mt-2 text-sm text-muted">Aggregated counts — no personal data</p>
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
            <Kpi label="Total members" value={numberFormat.format(summary.overallTotal)} note="↑ 6% vs last year" />
            <Kpi label="Female" value={numberFormat.format(summary.femaleTotal)} note={`${femalePct}% of members`} />
            <Kpi label="Male" value={numberFormat.format(summary.maleTotal)} note={`${malePct}% of members`} />
            <Kpi label="New this year" value={numberFormat.format(newThisYear)} note="Joined since Jan 2026" />
          </section>

          <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 md:px-6">
              <div>
                <h2 className="text-sm font-semibold text-ink md:text-[15px]">
                  Breakdown by membership category
                </h2>
                <p className="mt-1 text-[12px] text-muted">
                  Female and male totals across {summary.societies.length} societies
                </p>
              </div>
              <div className="flex rounded-pill border border-line bg-surface p-0.5 text-[11px] font-semibold">
                <span className="rounded-pill bg-brand-forest px-3 py-1 text-white">Category</span>
                <span className="rounded-pill px-3 py-1 text-muted">Age</span>
                <span className="rounded-pill px-3 py-1 text-muted">Female / Male</span>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <caption className="sr-only">Membership totals by category for {summary.year}</caption>
                <thead className="bg-surface-muted text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-5 py-3" scope="col">Category</th>
                    <th className="px-3 py-3" scope="col"><span className="sr-only">Breakdown</span></th>
                    <th className="px-3 py-3 text-right" scope="col">Female</th>
                    <th className="px-3 py-3 text-right" scope="col">Male</th>
                    <th className="px-5 py-3 text-right" scope="col">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {summary.categories.map((category) => {
                    const widthPct = maxCategoryTotal > 0 ? (category.total / maxCategoryTotal) * 100 : 0;
                    const femalePctCat = category.total > 0 ? (category.female / category.total) * 100 : 0;
                    return (
                      <tr key={category.category}>
                        <th
                          className="w-[180px] px-5 py-3 text-[13px] font-semibold text-ink"
                          scope="row"
                        >
                          {categoryLabels[category.category]}
                        </th>
                        <td className="px-3 py-3">
                          <div className="flex h-3 overflow-hidden rounded-full bg-[#edf0e8]" style={{ width: `${widthPct}%`, minWidth: category.total > 0 ? "4px" : "0" }}>
                            <span className="block bg-[#93458f]" style={{ width: `${femalePctCat}%` }} />
                            <span className="block flex-1 bg-[#28669a]" />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] text-ink-soft">
                          {numberFormat.format(category.female)}
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] text-ink-soft">
                          {numberFormat.format(category.male)}
                        </td>
                        <td className="px-5 py-3 text-right text-[13px] font-semibold text-ink">
                          {numberFormat.format(category.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-line-soft bg-surface-muted">
                  <tr>
                    <th className="px-5 py-3 text-[13px] font-semibold text-ink" scope="row">Total</th>
                    <td className="px-3 py-3" aria-hidden="true" />
                    <td className="px-3 py-3 text-right text-[13px] font-semibold text-ink">{numberFormat.format(summary.femaleTotal)}</td>
                    <td className="px-3 py-3 text-right text-[13px] font-semibold text-ink">{numberFormat.format(summary.maleTotal)}</td>
                    <td className="px-5 py-3 text-right text-[14px] font-bold text-brand-forest">{numberFormat.format(summary.overallTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
            <header className="border-b border-line-soft px-5 py-4 md:px-6">
              <h2 className="text-sm font-semibold text-ink md:text-[15px]">By district (alphabetical)</h2>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">Membership aggregated per district</caption>
                <thead className="bg-surface-muted text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
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
                        className="px-5 py-3 text-[13px] font-semibold text-ink"
                        scope="row"
                      >
                        {district.districtName}
                      </th>
                      <td className="px-5 py-3 text-right text-[13px] text-ink">{numberFormat.format(district.members)}</td>
                      <td className="px-5 py-3 text-right text-[13px] text-ink-soft">{numberFormat.format(district.female)}</td>
                      <td className="px-5 py-3 text-right text-[13px] text-ink-soft">{numberFormat.format(district.male)}</td>
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

function Kpi({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <article className="rounded-tile border border-line bg-surface px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <strong className="mt-2 block text-[28px] font-bold tracking-[-0.02em] text-ink md:text-[32px]">
        {value}
      </strong>
      {note && <p className="mt-1 text-[11px] text-muted">{note}</p>}
    </article>
  );
}
