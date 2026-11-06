import Link from "next/link";

import type { GradeQueueFilter, GradeQueueItem } from "@sarvodaya-connect/api-contracts";

import { EmptyState, primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { GradeChange } from "@/components/dashboard/grade-queue/grade-badge";
import type { MessageKey } from "@/i18n/messages/en";
import { getT } from "@/i18n/server";
import { roleName, waiting } from "@/i18n/society-record";
import { formatDate, formatNumber, type Translator } from "@/i18n/translate";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getGradeQueue } from "@/lib/society-record-api";

const TABS: GradeQueueFilter[] = ["WAITING", "APPROVED", "REJECTED", "ALL"];

const shortDate = (t: Translator, value: string) =>
  formatDate(t.locale, new Date(value), { day: "numeric", month: "short", timeZone: "Asia/Colombo" });

function Tile({ label, note, value, tone }: { label: string; note?: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <p className="text-[12.5px] text-ink-soft">{label}</p>
      <p className={`mt-1 text-[26px] font-bold leading-tight ${tone === "warn" ? "text-[#b8860b]" : "text-ink"}`}>{value}</p>
      {note && <p className="mt-1 text-[11.5px] text-ink-soft">{note}</p>}
    </div>
  );
}

function Status({ item, t }: { item: GradeQueueItem; t: Translator }) {
  if (item.status === "PENDING")
    return <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[11px] font-semibold text-warn-text">{t("sr.q.statusWaiting")}</span>;
  const approved = item.status === "APPROVED";
  const name = item.decidedBy?.displayName ?? "HQ";
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${approved ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"}`}>
      {item.decidedAt
        ? t(approved ? "sr.q.statusApprovedOn" : "sr.q.statusRejectedOn", { name, date: shortDate(t, item.decidedAt) })
        : t(approved ? "sr.q.statusApproved" : "sr.q.statusRejected", { name })}
    </span>
  );
}

/** V5 D22: HQ's grade-change queue. Only HQ decides; the API refuses everyone else. */
export default async function GradeQueuePage({ searchParams }: PageProps<"/reviews">) {
  const [, t] = await Promise.all([getCurrentViewer(), getT()]);
  const { status } = await searchParams;
  const filter = TABS.find((tab) => tab === status) ?? "WAITING";
  const queue = await getGradeQueue(filter);
  const { summary } = queue;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold text-ink">{t("sr.q.title")}</h2>
        <p className="mt-0.5 text-xs text-ink-soft">{t("sr.q.subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label={t("sr.q.waitingHq")}
          note={summary.oldestWaitingDays === null ? undefined : t.plural("sr.q.oldest", summary.oldestWaitingDays)}
          tone={summary.waiting ? "warn" : undefined}
          value={formatNumber(t.locale, summary.waiting)}
        />
        <Tile label={t("sr.q.approvedMonth")} value={formatNumber(t.locale, summary.approvedThisMonth)} />
        <Tile label={t("sr.q.rejectedMonth")} value={formatNumber(t.locale, summary.rejectedThisMonth)} />
        <Tile
          label={t("sr.q.average")}
          note={t("sr.q.averageNote")}
          value={summary.averageDecisionDays === null ? "—" : t.plural("sr.days", summary.averageDecisionDays)}
        />
      </div>

      <nav aria-label={t("sr.q.statusNav")} className="flex flex-wrap gap-x-6 border-b border-line">
        {TABS.map((tab) => (
          <Link
            aria-current={filter === tab ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-[13px] ${filter === tab ? "border-brand-forest font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
            href={tab === "WAITING" ? "/reviews" : `/reviews?status=${tab}`}
            key={tab}
          >
            {t(`sr.q.tab.${tab}` as MessageKey)}
            {tab === "WAITING" && (
              <span className="ml-1.5 rounded-md bg-state-grey px-1.5 text-[10.5px] text-ink-soft">{summary.waiting}</span>
            )}
          </Link>
        ))}
      </nav>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        {queue.data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <caption className="sr-only">{t("sr.q.title")}</caption>
              <thead className="bg-surface-muted text-[11.5px] text-ink-soft">
                <tr>
                  {(["colSociety", "colDistrict", "colChange", "colRequestedBy", "colSent", "colWaiting", "colStatus"] as const).map((heading) => (
                    <th className="px-3 py-3 font-semibold first:pl-4" key={heading} scope="col">{t(`sr.q.${heading}`)}</th>
                  ))}
                  <th className="px-3 py-3" scope="col"><span className="sr-only">{t("sr.q.colActions")}</span></th>
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
                        <span className="block text-[11.5px] text-ink-soft">{roleName(t, item.requestedBy.role)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{shortDate(t, item.requestedAt)}</td>
                    <td className="px-3 py-3">{item.status === "PENDING" ? waiting(t, item.requestedAt) : "—"}</td>
                    <td className="px-3 py-3"><Status item={item} t={t} /></td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <Link
                        aria-label={t(item.status === "PENDING" ? "sr.q.reviewLabel" : "sr.q.viewLabel", { society: item.society.name })}
                        className={item.status === "PENDING" ? primaryButtonClass : secondaryButtonClass}
                        href={`/reviews/${item.id}`}
                      >
                        {item.status === "PENDING" ? t("sr.q.review") : t("sr.q.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={filter === "WAITING" ? <Link className={secondaryButtonClass} href="/reviews?status=ALL">{t("sr.q.seeDecided")}</Link> : undefined}
            description={
              filter === "WAITING"
                ? t("sr.q.emptyWaitingBody")
                : filter === "APPROVED"
                  ? t("sr.q.emptyApproved")
                  : filter === "REJECTED"
                    ? t("sr.q.emptyRejected")
                    : t("sr.q.emptyAll")
            }
            title={filter === "WAITING" ? t("sr.q.emptyWaitingTitle") : t("sr.q.emptyTitle")}
          />
        )}
      </section>
      {queue.data.length === 200 && (
        <p className="text-[11.5px] text-ink-soft">{t("sr.q.latest200")}</p>
      )}
    </div>
  );
}
