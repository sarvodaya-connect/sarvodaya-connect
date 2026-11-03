import Link from "next/link";

import { EmptyState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon, type IconName } from "@/components/dashboard/icon";
import { Pagination, first } from "@/components/dashboard/national/parts";
import { getCurrentViewer } from "@/lib/current-viewer";
import { type Alert, getAlerts } from "@/lib/national-api";

import { markAllAlertsRead, openAlert } from "./actions";

const FILTERS = [
  { key: "", label: "All" },
  { key: "grades", label: "Grade requests" },
  { key: "incidents", label: "Incidents" },
  { key: "access", label: "Access" },
  { key: "records", label: "Records" },
  { key: "activities", label: "Activities" },
] as const;

const TOPIC_STYLE: Record<string, { icon: IconName; className: string }> = {
  GRADE_REQUEST: { icon: "flag", className: "bg-[#fff5d9] text-[#7a5a00]" },
  INCIDENT: { icon: "alert", className: "bg-[#fbe9e7] text-[#a8312a]" },
  ACCESS: { icon: "key", className: "bg-[#e5eef8] text-[#315d88]" },
  ACCOUNT: { icon: "user", className: "bg-[#f0f1ee] text-[#55605a]" },
  RECORDS: { icon: "document", className: "bg-[#fbe9e7] text-[#a8312a]" },
  INFORMATION_REQUEST: { icon: "inbox", className: "bg-[#e5eef8] text-[#315d88]" },
  ACTIVITY: { icon: "check", className: "bg-[#e6f0e7] text-[#26744b]" },
};

function when(value: string) {
  return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" });
}

function AlertRow({ alert }: { alert: Alert }) {
  const style = TOPIC_STYLE[alert.topic ?? ""] ?? { icon: "bell" as IconName, className: "bg-[#f0f1ee] text-[#55605a]" };
  return (
    <li className={alert.read ? "" : "border-r-4 border-brand-forest bg-[#f3f8f3]"}>
      <form action={openAlert}>
        <input name="id" type="hidden" value={alert.id} />
        <input name="link" type="hidden" value={alert.linkPath ?? "/notifications"} />
        <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-mint-soft" type="submit">
          <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full ${style.className}`}>
            <Icon className="size-4" name={style.icon} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[13px] text-ink">
              {!alert.read && <span className="sr-only">Unread: </span>}
              {alert.title}
            </strong>
            <span className="block text-[11px] text-muted">{[alert.body, when(alert.createdAt)].filter(Boolean).join(" · ")}</span>
          </span>
          <Icon aria-hidden className="size-4 text-muted" name="chevron" />
        </button>
      </form>
    </li>
  );
}

/** V5 D19 Alerts: the signed-in user's own notifications, newest first. */
export default async function AlertsPage({ searchParams }: PageProps<"/notifications">) {
  await getCurrentViewer();
  const params = await searchParams;
  const filter = FILTERS.find((item) => item.key === first(params.filter))?.key ?? "";
  const page = Math.max(1, Number(first(params.page)) || 1);
  const alerts = await getAlerts({ filter: filter || undefined, page });
  const href = (changes: { filter?: string; page?: number }) => {
    const search = new URLSearchParams();
    const nextFilter = changes.filter ?? filter;
    if (nextFilter) search.set("filter", nextFilter);
    if (changes.page && changes.page > 1) search.set("page", String(changes.page));
    const text = search.toString();
    return text ? `/notifications?${text}` : "/notifications";
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Alerts</h1>
          <p className="text-[12px] text-ink-soft">{alerts.meta.unreadCount} unread</p>
        </div>
        {alerts.meta.unreadCount > 0 && (
          <form action={markAllAlertsRead}>
            <button className={secondaryButtonClass} type="submit">Mark all read</button>
          </form>
        )}
      </div>
      <nav aria-label="Alert types" className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            aria-current={item.key === filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${item.key === filter ? "border-brand-forest bg-brand-forest text-white" : "border-line bg-surface text-ink"}`}
            href={href({ filter: item.key, page: 1 })}
            key={item.key || "all"}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-3">
        {alerts.data.length === 0 ? (
          <EmptyState description={filter ? "No alerts of this type. Choose All to see everything." : "Requests, incidents, access changes and record reminders appear here."} icon="success" title="No alerts" />
        ) : (
          <ul className="divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
            {alerts.data.map((alert) => <AlertRow alert={alert} key={alert.id} />)}
          </ul>
        )}
      </div>
      <div className="mt-2 flex justify-end text-[11px] text-muted">
        <Pagination href={(target) => href({ page: target })} page={page} totalPages={alerts.meta.totalPages} />
      </div>
    </>
  );
}
