import Link from "next/link";

import type { GradeQueueFilter, GradeQueueItem } from "@sarvodaya-connect/api-contracts";

import { EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { GradeChange } from "@/components/dashboard/grade-queue/grade-badge";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getGradeQueue } from "@/lib/society-record-api";
import { ROLE_LABELS, waitingLabel } from "@/lib/society-record-format";

const TABS: { key: GradeQueueFilter; label: string }[] = [
  { key: "WAITING", label: "Waiting" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Colombo" });

function Tile({ label, note, value, tone }: { label: string; note?: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <p className="text-[12.5px] text-ink-soft">{label}</p>
      <p className={`mt-1 text-[26px] font-bold leading-tight ${tone === "warn" ? "text-[#b8860b]" : "text-ink"}`}>{value}</p>
      {note && <p className="mt-1 text-[11.5px] text-ink-soft">{note}</p>}
    </div>
  );
}

function Status({ item }: { item: GradeQueueItem }) {
  if (item.status === "PENDING")
    return <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[11px] font-semibold text-warn-text">● Waiting</span>;
  const approved = item.status === "APPROVED";
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${approved ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"}`}>
      ● {approved ? "Approved" : "Rejected"} by {item.decidedBy?.displayName}
      {item.decidedAt ? ` · ${shortDate.format(new Date(item.decidedAt))}` : ""}
    </span>
  );
}

/** V5 D22: HQ's grade-change queue. Only HQ decides; the API refuses everyone else. */
export default async function GradeQueuePage({ searchParams }: PageProps<"/reviews">) {
  await getCurrentViewer();
  const { status } = await searchParams;
  const filter = TABS.find((tab) => tab.key === status)?.key ?? "WAITING";
  const queue = await getGradeQueue(filter);
  const { summary } = queue;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-ink">Grade-change requests</h2>
        <p className="mt-0.5 text-xs text-ink-soft">Only HQ can change a society&apos;s grade. Requests come from Society Officers, SPCs and DDMs.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Waiting for HQ"
          note={summary.oldestWaitingDays === null ? undefined : `Oldest: ${summary.oldestWaitingDays} ${summary.oldestWaitingDays === 1 ? "day" : "days"}`}
          tone={summary.waiting ? "warn" : undefined}
          value={String(summary.waiting)}
        />
        <Tile label="Approved this month" value={String(summary.approvedThisMonth)} />
        <Tile label="Rejected this month" value={String(summary.rejectedThisMonth)} />
        <Tile
          label="Average decision time"
          note="Decisions in the last 90 days"
          value={summary.averageDecisionDays === null ? "—" : `${summary.averageDecisionDays} days`}
        />
      </div>

      <nav aria-label="Request status" className="flex flex-wrap gap-x-6 border-b border-line">
        {TABS.map((tab) => (
          <Link
            aria-current={filter === tab.key ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-[13px] ${filter === tab.key ? "border-brand-forest font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
            href={tab.key === "WAITING" ? "/reviews" : `/reviews?status=${tab.key}`}
            key={tab.key}
          >
            {tab.label}
            {tab.key === "WAITING" && (
              <span className="ml-1.5 rounded-md bg-state-grey px-1.5 text-[10.5px] text-ink-soft">{summary.waiting}</span>
            )}
          </Link>
        ))}
      </nav>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        {queue.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <caption className="sr-only">Grade-change requests</caption>
              <thead className="bg-surface-muted text-[11.5px] text-ink-soft">
                <tr>
                  {["Society", "District", "Change", "Requested by", "Sent", "Waiting", "Status"].map((heading) => (
                    <th className="px-3 py-3 font-semibold first:pl-4" key={heading} scope="col">{heading}</th>
                  ))}
                  <th className="px-3 py-3" scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {queue.data.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pl-4 pr-3">
                      <strong className="block font-semibold text-ink">{item.society.name}</strong>
                      <span className="text-[11.5px] text-ink-soft">{item.society.societyCode}</span>
                    </td>
                    <td className="px-3 py-3">{item.society.district}</td>
                    <td className="px-3 py-3"><GradeChange from={item.fromGrade} to={item.toGrade} /></td>
                    <td className="px-3 py-3">
                      {item.requestedBy.displayName}
                      {item.requestedBy.role && (
                        <span className="block text-[11.5px] text-ink-soft">{ROLE_LABELS[item.requestedBy.role]}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{shortDate.format(new Date(item.requestedAt))}</td>
                    <td className="px-3 py-3">{item.status === "PENDING" ? waitingLabel(item.requestedAt) : "—"}</td>
                    <td className="px-3 py-3"><Status item={item} /></td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <Link
                        aria-label={`${item.status === "PENDING" ? "Review" : "View"} ${item.society.name} grade request`}
                        className={item.status === "PENDING" ? primaryButtonClass : secondaryButtonClass}
                        href={`/reviews/${item.id}`}
                      >
                        {item.status === "PENDING" ? "Review" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={filter === "WAITING" ? <Link className={secondaryButtonClass} href="/reviews?status=ALL">See decided requests</Link> : undefined}
            description={
              filter === "WAITING"
                ? "New requests from Society Officers, SPCs and DDMs will appear here."
                : `No ${filter === "ALL" ? "" : `${filter.toLowerCase()} `}requests yet.`
            }
            title={filter === "WAITING" ? "No grade requests waiting" : "Nothing here yet"}
          />
        )}
      </section>
      {queue.data.length === 200 && (
        <p className="text-[11.5px] text-ink-soft">Showing the latest 200 requests. Earlier ones are on each society&apos;s Grade tab.</p>
      )}
    </div>
  );
}
