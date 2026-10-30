import type { WorkPlanOverview as WorkPlan } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { actorLabel, formatDate, formatLkr, MONTHS } from "@/lib/society-record-format";

/** D05w: the society's planned activities by month. Planning figures only. */
export function WorkPlanOverview({ plan }: { plan: WorkPlan }) {
  const perMonth = MONTHS.map((_, index) => plan.activities.filter((activity) => activity.month === index + 1).length);
  return (
    <>
      <div className="mt-4 flex items-start gap-2.5 rounded-card border border-[#ead9a7] bg-warn-bg px-4 py-3 text-[11px] text-warn-text">
        <Icon className="mt-0.5 size-4 shrink-0" name="clipboard" />
        <div>
          <p className="font-bold">Activity planning only</p>
          <p>
            Allocated costs are planning figures for each activity. They are not payments or accounts — no loans, savings or
            transactions are recorded.
          </p>
        </div>
      </div>

      <ol aria-label={`Activities per month in ${plan.year}`} className="mt-3 grid grid-cols-6 gap-2 rounded-card border border-line bg-surface p-3 md:grid-cols-12">
        {MONTHS.map((month, index) => (
          <li
            className={`rounded-lg px-2 py-1.5 text-center ${perMonth[index] ? "bg-brand-mint text-brand-forest" : "bg-[#f4f5f2] text-[#a3aba5]"}`}
            key={month}
          >
            <span className="block text-[10px] font-semibold">{month}</span>
            <span className="block text-[12px] font-bold">{perMonth[index] || "–"}</span>
          </li>
        ))}
      </ol>

      {plan.activities.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-surface px-5 py-8 text-center text-[12px] text-muted">
          No activities are planned for {plan.year} yet. The Society Officer, SPC or DDM adds them from the phone app.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-[11px]">
            <thead className="bg-[#f6f7f4] text-[10px] text-muted">
              <tr>
                {["Month", "Activity", "Description", "Sector", "Allocated (LKR)"].map((heading) => (
                  <th className="px-4 py-2 font-medium" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {plan.activities.map((activity) => (
                <tr key={activity.id}>
                  <td className="px-4 py-2.5 text-ink-soft">{MONTHS[activity.month - 1]}</td>
                  <td className="px-4 py-2.5 font-bold text-ink">
                    {activity.name}
                    {activity.datesLabel && <span className="block text-[10px] font-normal text-muted">{activity.datesLabel}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{activity.description}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{activity.sector ?? "—"}</td>
                  <td className="px-4 py-2.5 font-bold text-ink">{activity.allocatedCost.toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap justify-between gap-2 border-t border-line-soft px-4 py-2.5 text-[10px]">
            <span className="text-muted">
              {plan.lastChange ? `Last changed by ${actorLabel(plan.lastChange.by)} · ${formatDate(plan.lastChange.at)}` : ""}
            </span>
            <span className="font-bold text-ink">Total allocated for planning: {formatLkr(plan.totalAllocated)}</span>
          </div>
        </div>
      )}
    </>
  );
}
