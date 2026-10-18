import type { MembershipDashboardSummary } from "@sarvodaya-connect/api-contracts";
import { PageHeading } from "./page-heading";

const categoryLabels: Record<string, string> = {
  CHILDREN: "Children",
  YOUTH: "Youth",
  MOTHERS: "Mothers",
  ORDINARY: "Ordinary members",
  ELDERS_COUNCIL: "Elders Council",
};
const numberFormat = new Intl.NumberFormat("en-GB");

export function MembershipDashboard({
  summary,
}: {
  summary: MembershipDashboardSummary;
}) {
  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <PageHeading
          description={`Membership registered across societies in your role scope for ${summary.year}.`}
          title="Membership"
        />
        <span className="rounded-full border border-[#e5d59f] bg-[#fff9e9] px-3 py-1.5 text-[11px] font-semibold text-[#755a08]">
          Demonstration Data
        </span>
      </div>

      {summary.societies.length === 0 ? (
        <section className="mt-6 rounded-xl border border-[#dfe5dc] bg-white px-6 py-14 text-center shadow-sm">
          <h2 className="text-base font-semibold text-[#223329]">
            No membership records in your scope
          </h2>
          <p className="mt-2 text-sm text-[#68756c]">
            Membership summaries will appear here when societies in your role
            scope have submitted their figures.
          </p>
        </section>
      ) : (
        <>
          <section
            aria-label="Overall membership totals"
            className="mt-6 grid gap-3 sm:grid-cols-3"
          >
            {[
              ["Female members", summary.femaleTotal],
              ["Male members", summary.maleTotal],
              ["Total members", summary.overallTotal],
            ].map(([label, total]) => (
              <article
                className="rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-[0_8px_26px_rgba(24,56,35,0.04)]"
                key={label}
              >
                <p className="text-xs font-medium text-[#718078]">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-[#174a32]">
                  {numberFormat.format(total as number)}
                </p>
              </article>
            ))}
          </section>

          <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
            <div className="border-b border-[#e4e8e2] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#223329]">
                Membership by category
              </h2>
              <p className="mt-1 text-xs text-[#738078]">
                Female and male totals across {summary.societies.length}{" "}
                societies
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <caption className="sr-only">
                  Membership totals by category for {summary.year}
                </caption>
                <thead className="bg-[#f7f8f5] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#738078]">
                  <tr>
                    <th className="px-5 py-3" scope="col">
                      Category
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Female
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Male
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0eb]">
                  {summary.categories.map((category) => (
                    <tr key={category.category}>
                      <th
                        className="px-5 py-3.5 text-sm font-medium text-[#35443a]"
                        scope="row"
                      >
                        {categoryLabels[category.category]}
                      </th>
                      <td className="px-5 py-3.5 text-right text-sm text-[#526057]">
                        {numberFormat.format(category.female)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-[#526057]">
                        {numberFormat.format(category.male)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#223329]">
                        {numberFormat.format(category.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#e4e8e2] bg-[#f7f8f5]">
                  <tr>
                    <th
                      className="px-5 py-3.5 text-sm font-semibold text-[#223329]"
                      scope="row"
                    >
                      Total
                    </th>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#223329]">
                      {numberFormat.format(summary.femaleTotal)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#223329]">
                      {numberFormat.format(summary.maleTotal)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm font-bold text-[#174a32]">
                      {numberFormat.format(summary.overallTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
            <div className="border-b border-[#e4e8e2] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#223329]">
                Society summaries
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">
                  Membership totals per society
                </caption>
                <thead className="bg-[#f7f8f5] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#738078]">
                  <tr>
                    <th className="px-5 py-3" scope="col">
                      Society
                    </th>
                    <th className="px-5 py-3" scope="col">
                      District
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Female
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Male
                    </th>
                    <th className="px-5 py-3 text-right" scope="col">
                      Total members
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0eb]">
                  {summary.societies.map((society) => (
                    <tr key={society.societyId}>
                      <th
                        className="px-5 py-3.5 text-sm font-medium text-[#35443a]"
                        scope="row"
                      >
                        <span className="block">{society.societyName}</span>
                        <span className="mt-1 block text-xs font-normal text-[#738078]">
                          {society.societyCode}
                        </span>
                      </th>
                      <td className="px-5 py-3.5 text-sm text-[#526057]">
                        {society.districtName}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-[#526057]">
                        {numberFormat.format(society.femaleTotal)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm text-[#526057]">
                        {numberFormat.format(society.maleTotal)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-[#223329]">
                        {numberFormat.format(society.overallTotal)}
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
