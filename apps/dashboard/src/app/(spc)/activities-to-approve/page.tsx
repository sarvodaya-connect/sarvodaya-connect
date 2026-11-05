import Link from "next/link";

import type { ActivityQueueItem } from "@sarvodaya-connect/api-contracts";

import { ApprovalRuleNotice } from "@/components/dashboard/activities/approval-notice";
import { EmptyState } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { SdgChips } from "@/components/dashboard/sdg/sdg-chip";
import { Pill } from "@/components/dashboard/ui/pill";
import { getActivityQueue } from "@/lib/activities-api";
import { approvedLabel, monthYear, participantsLabel, sdgList, waitingStatus } from "@/lib/activity-format";
import { isDemoMode } from "@/lib/platform-api";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function DecisionBanner({ queue, approvedId, sentBackId }: { queue: { approvedRecently: ActivityQueueItem[] }; approvedId?: string; sentBackId?: string }) {
  const approved = approvedId && queue.approvedRecently.find((item) => item.id === approvedId);
  if (approved) {
    return (
      <p className="flex items-center gap-2.5 rounded-card border border-[#bcd9bd] bg-success-bg px-4 py-2.5 text-[12px] text-success-text" role="status">
        <Icon className="size-4 shrink-0" name="success" />
        <span>
          <strong>
            Approved: {approved.name} · {approved.society.name}.
          </strong>{" "}
          {sdgList(approved.sdgs)}.{approved.sentBy ? ` ${approved.sentBy.displayName} has been notified.` : ""}
        </span>
      </p>
    );
  }
  if (sentBackId) {
    return (
      <p className="flex items-center gap-2.5 rounded-card border border-[#ead9a7] bg-warn-bg px-4 py-2.5 text-[12px] text-warn-text" role="status">
        <Icon className="size-4 shrink-0" name="undo" />
        <span>The activity was sent back to the Society Officer. It stays out of the dashboards until you approve it.</span>
      </p>
    );
  }
  return null;
}

const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
const td = "px-3 py-3 text-[12px] text-ink";

/** V5 SP06 (and SP08 after an approval): the SPC's waiting activities and recent approvals. */
export default async function ActivitiesToApprovePage({ searchParams }: PageProps<"/activities-to-approve">) {
  const params = await searchParams;
  const queue = await getActivityQueue();
  const now = new Date();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Activities to Approve</h1>
          <p className="text-[12px] text-ink-soft">
            {queue.waiting.length} waiting from your {queue.societyCount} {queue.societyCount === 1 ? "society" : "societies"}
          </p>
        </div>
        {isDemoMode() && <Pill tone="preview">Sample data · demonstration mode</Pill>}
      </div>

      <div className="mt-4 space-y-3">
        <DecisionBanner approvedId={first(params.approved)} queue={queue} sentBackId={first(params.sentBack)} />
        <ApprovalRuleNotice />
      </div>

      <section aria-labelledby="waiting-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">1 · Waiting for You</p>
        <h2 className="text-[15px] font-bold text-ink" id="waiting-heading">Waiting ({queue.waiting.length})</h2>
        {queue.waiting.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              description="New activities from your societies appear here when their Society Officer sends them."
              icon="success"
              title="Nothing Is Waiting for You"
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#f2f4f0]">
                <tr>
                  {["Activity", "Society", "Sent by", "When", "Participants", "Status"].map((heading) => (
                    <th className={th} key={heading} scope="col">{heading}</th>
                  ))}
                  <th className={th}><span className="sr-only">Review</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {queue.waiting.map((item) => (
                  <tr key={item.id}>
                    <td className={td}>
                      <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/activities-to-approve/${item.id}`}>
                        {item.name}
                      </Link>
                    </td>
                    <td className={td}>{item.society.name}</td>
                    <td className={td}>{item.sentBy?.displayName ?? "—"}</td>
                    <td className={td}>{monthYear(item)}</td>
                    <td className={td}>{participantsLabel(item)}</td>
                    <td className={td}><Pill tone="fast-target">{waitingStatus(item.submittedAt, now)}</Pill></td>
                    <td className={`${td} text-right`}>
                      <Link
                        className="inline-flex rounded-button border border-line bg-surface px-4 py-2 text-[12px] font-semibold text-ink hover:border-brand-leaf"
                        href={`/activities-to-approve/${item.id}`}
                      >
                        Review<span className="sr-only">: {item.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="approved-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">2 · Approved</p>
        <h2 className="text-[15px] font-bold text-ink" id="approved-heading">Approved Recently</h2>
        {queue.approvedRecently.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[#f4f5f1] px-4 py-6 text-center text-[12px] text-muted">
            No activities approved in the last 30 days.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#f2f4f0]">
                <tr>
                  {["Activity", "Society", "Approved", "UN SDGs"].map((heading) => (
                    <th className={th} key={heading} scope="col">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {queue.approvedRecently.map((item) => (
                  <tr key={item.id}>
                    <td className={td}>{item.name}</td>
                    <td className={td}>{item.society.name}</td>
                    <td className={td}>{approvedLabel(item.approvedAt, now)}</td>
                    <td className={td}><SdgChips sdgs={item.sdgs} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
