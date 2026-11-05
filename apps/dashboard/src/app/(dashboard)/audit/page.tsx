import Link from "next/link";

import type { AuditLogEntry, ScopeOptions } from "@sarvodaya-connect/api-contracts";

import { AdministrationTabs } from "@/components/dashboard/accounts/administration-tabs";
import { EmptyState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import {
  AUDIT_PERIODS,
  AUDIT_TYPE_LABELS,
  HIGHLIGHT,
  actionLabel,
  auditQuery,
  parseAuditFilters,
  roleLabel,
} from "@/lib/audit-log";
import { getCurrentViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";
import { ROLE_LABELS } from "@/lib/society-record-format";

const when = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" });
const selectClass =
  "h-[38px] rounded-[10px] border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-brand-leaf focus:ring-3 focus:ring-brand-mint";
const chip = {
  temporary: "bg-[var(--banner-temporary-bg)] text-[var(--banner-temporary-text)]",
  approved: "bg-success-bg text-success-text",
  requested: "bg-warn-bg text-warn-text",
  rejected: "bg-danger-bg text-danger-text",
};

/** V5 D24: who changed, approved or opened what, and when. The API applies the viewer's scope. */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  await getCurrentViewer();
  const filters = parseAuditFilters(await searchParams);
  const query = auditQuery(filters);
  const [{ data }, options]: [{ data: AuditLogEntry[] }, ScopeOptions] = await Promise.all([
    platformApi(`/identity/audit?${query}`),
    platformApi("/identity/scope-options"),
  ]);

  return (
    <section className="flex flex-col gap-4">
      <AdministrationTabs current="log" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Change &amp; Access Log</h2>
          <p className="mt-0.5 text-xs text-ink-soft">Who changed, approved or opened what, and when. NICs, passwords and credentials are never shown here.</p>
        </div>
        <a className={secondaryButtonClass} download href={`/audit/export?${query}`}>
          <Icon className="size-4" name="document" strokeWidth={2} />
          Export log
        </a>
      </div>

      <form action="/audit" className="flex flex-wrap items-center gap-2.5" role="search">
        <label className="relative w-full max-w-[280px]">
          <span className="sr-only">Society, user or S number</span>
          <Icon className="absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[#6a776e]" name="search" strokeWidth={2} />
          <input
            className="h-[38px] w-full rounded-[10px] border border-line bg-surface pl-[34px] pr-3 text-xs outline-none focus:border-brand-leaf focus:ring-3 focus:ring-brand-mint"
            defaultValue={filters.q}
            name="q"
            placeholder="Society, user or S number"
            type="search"
          />
        </label>
        <label>
          <span className="sr-only">District</span>
          <select className={`${selectClass} ${filters.districtId ? "border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] font-semibold text-[var(--banner-edit-text)]" : ""}`} defaultValue={filters.districtId} name="districtId">
            <option value="">District: All</option>
            {options.districts.map((district) => (
              <option key={district.id} value={district.id}>District: {district.nameEn}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Type</span>
          <select className={selectClass} defaultValue={filters.type} name="type">
            <option value="">Type: All</option>
            {Object.entries(AUDIT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>Type: {label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Role</span>
          <select className={selectClass} defaultValue={filters.role} name="role">
            <option value="">Role: All</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>Role: {label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Period</span>
          <select className={selectClass} defaultValue={filters.days} name="days">
            {AUDIT_PERIODS.map((period) => (
              <option key={period.days} value={period.days}>{period.label}</option>
            ))}
          </select>
        </label>
        <button className={secondaryButtonClass} type="submit">Apply</button>
        {(filters.q || filters.districtId || filters.type || filters.role || filters.days !== "30") && (
          <Link className="text-xs font-semibold text-brand-action underline underline-offset-2" href="/audit">Clear filters</Link>
        )}
      </form>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        {data.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-[13px]">
              <caption className="sr-only">Change and Access Log</caption>
              <thead className="bg-surface-muted text-[11.5px] text-ink-soft">
                <tr>
                  {["When", "Who", "What", "Society or scope", "Details", "Approved by"].map((heading) => (
                    <th className="px-3 py-3 font-semibold first:pl-4" key={heading} scope="col">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {data.map((entry) => {
                  const tone = HIGHLIGHT[entry.action];
                  return (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap py-3 pl-4 pr-3">{when.format(new Date(entry.createdAt))}</td>
                      <td className="px-3 py-3">
                        {entry.actor.displayName}
                        {entry.actor.role && <span className="block text-[11.5px] text-ink-soft">{roleLabel(entry.actor.role)}</span>}
                      </td>
                      <td className="px-3 py-3">
                        {tone ? (
                          <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${chip[tone]}`}>● {actionLabel(entry.action)}</span>
                        ) : (
                          actionLabel(entry.action)
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {entry.societyId ? (
                          <Link className="text-brand-action underline underline-offset-2" href={`/societies/${entry.societyId}`}>{entry.scope}</Link>
                        ) : (
                          entry.scope
                        )}
                      </td>
                      <td className="max-w-[420px] px-3 py-3 text-ink-soft">{entry.detail || "—"}</td>
                      <td className="px-3 py-3">{entry.approvedBy ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={<Link className={secondaryButtonClass} href="/audit">Clear filters</Link>}
            description="Nothing matches these filters in this period."
            icon="search"
            title="No Log Entries"
          />
        )}
      </section>
      {data.length === 500 && <p className="text-[11.5px] text-ink-soft">Showing the latest 500 entries. Narrow the filters or export to see the rest of this period.</p>}
    </section>
  );
}
