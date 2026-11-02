import Link from "next/link";

import type { WorkPlanActivity, WorkPlanOverview as WorkPlan } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { SdgChips } from "../sdg/sdg-chip";
import { Pill } from "../ui/pill";
import { actorLabel, formatDate, formatLkr, MONTHS } from "@/lib/society-record-format";

/** V5 statuses: only approved activities count in the dashboards. */
export function ActivityStatusPill({ activity }: { activity: Pick<WorkPlanActivity, "status"> }) {
  if (activity.status === "APPROVED") return <Pill tone="verified">Approved</Pill>;
  if (activity.status === "SENT_BACK") return <Pill tone="returned">Sent back</Pill>;
  return <Pill tone="fast-target">Waiting for SPC</Pill>;
}

/** D05w: the society's planned activities by month. Planning figures only. */
export function WorkPlanOverview({ plan, societyId }: { plan: WorkPlan; societyId: string }) {
  const perMonth = MONTHS.map((_, index) => plan.activities.filter((activity) => activity.month === index + 1).length);
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[280px] flex-1 items-start gap-2.5 rounded-card border border-dashed border-[#ead9a7] bg-warn-bg px-4 py-3 text-[11px] text-warn-text">
          <Icon className="mt-0.5 size-4 shrink-0" name="clipboard" />
          <div>
            <p className="font-bold">Activity planning only</p>
            <p>
              Allocated costs are planning figures for each activity. They are not payments or accounts — no loans, savings or
              transactions are recorded.
            </p>
          </div>
        </div>
        {plan.permissions?.canAddActivities && (
          <Link
            className="inline-flex items-center gap-2 rounded-button bg-brand-action px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-brand-action-pressed"
            href={`/societies/${societyId}/work-plan/new?year=${plan.year}`}
          >
            + Add activity
          </Link>
        )}
      </div>
      {plan.counts && plan.activities.length > 0 && (
        <p className="mt-3 text-[12px] text-ink-soft">
          <strong className="text-ink">{plan.counts.planned}</strong> planned · {plan.counts.approved} approved by the SPC ·{" "}
          {plan.counts.waiting} waiting{plan.counts.sentBack ? ` · ${plan.counts.sentBack} sent back` : ""}. Only approved
          activities count in the dashboards.
        </p>
      )}

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
          No activities are planned for {plan.year} yet. The Society Officer adds them from the phone app; the SPC approves them.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[980px] text-left text-[11px]">
            <thead className="bg-[#f6f7f4] text-[10px] text-muted">
              <tr>
                {["Month", "Activity", "Description", "Sector", "Status", "UN SDGs", "Allocated (LKR)"].map((heading) => (
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
                  <td className="px-4 py-2.5"><ActivityStatusPill activity={activity} /></td>
                  <td className="px-4 py-2.5"><SdgChips sdgs={activity.sdgs ?? []} /></td>
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
