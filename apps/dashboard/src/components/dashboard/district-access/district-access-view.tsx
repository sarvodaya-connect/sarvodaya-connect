import Link from "next/link";
import type { ReactNode } from "react";

import type { DistrictAccessGrantDetail, DistrictAccessGrantView, DistrictAccessHistoryEntry } from "@sarvodaya-connect/api-contracts";

import { periodLabel, shortDateTime, timeLeft } from "@/lib/home-format";

import { Icon } from "../icon";
import { AccessBanner } from "../ui/access-banner";

const STATUS: Record<DistrictAccessGrantView["status"], { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-info-bg text-info-text" },
  SCHEDULED: { label: "Starts later", className: "bg-warn-bg text-warn-text" },
  ENDED: { label: "Ended on its own", className: "bg-[#f0f1ee] text-[#56615a]" },
  ENDED_EARLY: { label: "Ended early", className: "bg-[#f0f1ee] text-[#56615a]" },
};

export function GrantStatus({ grant }: { grant: DistrictAccessGrantView }) {
  const status = STATUS[grant.status];
  const label = grant.status === "ENDED_EARLY" && grant.endedEarly?.byName ? `Ended early by ${grant.endedEarly.byName}` : status.label;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${status.className}`}>
      <span aria-hidden="true">●</span> {label}
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

/** One active (or starting) grant, as on DM04 "Current Grant" and DM01. */
export function CurrentGrant({ grant, now, endButton }: { grant: DistrictAccessGrantView; now: Date; endButton?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info-bg text-[12px] font-bold text-info-text">{initials(grant.deputy.name)}</span>
      <div className="min-w-0 flex-1 text-[12px] text-ink-soft">
        <strong className="block text-[14px] text-ink">{grant.deputy.name} · DDM</strong>
        View only · all {grant.district.societyCount} {grant.district.name} societies · {shortDateTime(grant.startsAt)} → {shortDateTime(grant.expiresAt)}
        {grant.reason ? ` · reason: ${grant.reason}` : ""}
        <span className="block text-ink">
          Opened {grant.societiesOpened} district {grant.societiesOpened === 1 ? "society" : "societies"} so far ·{" "}
          <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/district-access?grant=${grant.id}`}>
            See access history
          </Link>
          {grant.status === "SCHEDULED" ? " · starts later" : ` · ${timeLeft(grant.expiresAt, now)}`}
        </span>
      </div>
      {endButton}
    </div>
  );
}

const HISTORY_LABEL: Record<DistrictAccessHistoryEntry["kind"], (entry: DistrictAccessHistoryEntry) => string> = {
  GIVEN: () => "Access given · view only",
  STARTED: () => "Access started",
  OPENED: (entry) => `Opened ${entry.societyName ?? "a society"}`,
  ENDED: () => "Access ended on its own",
  ENDED_EARLY: () => "Access ended early",
};

/** DM04 "See details" / M32: the grant and everything recorded against it. */
export function GrantDetail({ grant, now, endButton }: { grant: DistrictAccessGrantDetail; now: Date; endButton?: ReactNode }) {
  const lengthHours = Math.round((Date.parse(grant.expiresAt) - Date.parse(grant.startsAt)) / 3_600_000);
  const length = lengthHours >= 24 ? `${Math.floor(lengthHours / 24)} days${lengthHours % 24 ? ` ${lengthHours % 24} hours` : ""}` : `${lengthHours} hours`;
  const kv = (label: string, value: string) => (
    <div>
      <span className="block text-[11px] text-ink-soft">{label}</span>
      <strong className="text-[13px] text-ink">{value}</strong>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-card border-2 border-info-text/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <strong className="text-[14px] text-ink">{grant.deputy.name} · DDM</strong>
          <GrantStatus grant={grant} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {kv("Starts", shortDateTime(grant.startsAt))}
          {kv("Ends", shortDateTime(grant.expiresAt))}
          {kv("Length", length)}
          {kv("Reason", grant.reason || "Not given")}
          {kv("Given by", `${grant.grantedBy.name ?? "District Manager"} · ${shortDateTime(grant.grantedAt)}`)}
          {kv("Access", `View only · ${grant.district.societyCount} societies`)}
        </div>
        {grant.status === "ACTIVE" && <p className="text-[12.5px] font-semibold text-ink">{timeLeft(grant.expiresAt, now)}</p>}
        {endButton}
      </div>
      <section aria-labelledby="history-heading">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-ink" id="history-heading">
            Access History
          </h3>
          <span className="text-[11px] text-ink-soft">Recorded</span>
        </div>
        <ol className="mt-2 flex flex-col gap-2.5">
          {grant.history.map((entry, index) => (
            <li className="flex gap-2.5" key={`${entry.kind}-${entry.at}-${index}`}>
              <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded-[3px] border-2 ${entry.kind === "OPENED" ? "border-info-text" : "border-[#e07b2e]"}`} />
              <span className="text-[12px] text-ink-soft">
                <strong className="block text-[12.5px] text-ink">{HISTORY_LABEL[entry.kind](entry)}</strong>
                {entry.actorName ? `${entry.actorName} · ` : ""}
                {shortDateTime(entry.at)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** DM04 "Grants you have given". */
export function GrantHistoryTable({ grants }: { grants: DistrictAccessGrantView[] }) {
  if (!grants.length) {
    return <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">You have not given temporary access yet.</p>;
  }
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-muted">
          <tr>
            <th className={th} scope="col">DDM</th>
            <th className={th} scope="col">Access</th>
            <th className={th} scope="col">Period</th>
            <th className={th} scope="col">Status</th>
            <th className={th} scope="col"><span className="sr-only">Details</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {grants.map((grant) => (
            <tr key={grant.id}>
              <td className="px-3 py-3 text-[12.5px] text-ink">{grant.deputy.name}</td>
              <td className="px-3 py-3 text-[12.5px] text-ink">View only · {grant.district.societyCount} societies</td>
              <td className="px-3 py-3 text-[12.5px] text-ink">{periodLabel(grant.startsAt, grant.expiresAt)}</td>
              <td className="px-3 py-3"><GrantStatus grant={grant} /></td>
              <td className="px-3 py-3 text-right">
                <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href={`/district-access?grant=${grant.id}`}>
                  Details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Right-hand drawer over the page (DM05, grant details). */
export function Drawer({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link aria-label="Close" className="absolute inset-0 bg-[#1b261f]/45" href="/district-access" />
      <aside aria-labelledby="drawer-heading" aria-modal="true" className="relative h-full w-full max-w-[520px] overflow-y-auto bg-surface px-6 py-5 shadow-2xl" role="dialog">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-ink" id="drawer-heading">{title}</h2>
            {subtitle && <p className="text-[12px] text-ink-soft">{subtitle}</p>}
          </div>
          <Link aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink hover:bg-brand-mint-soft" href="/district-access">
            <Icon className="size-4" name="close" strokeWidth={2} />
          </Link>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function DmAccessBanner({ districtName, societyCount }: { districtName: string; societyCount: number }) {
  return (
    <AccessBanner tone="viewOnly">
      Your access: <strong>all {societyCount} {districtName} societies · view only</strong>. You cannot edit society information or request, approve or change grades.
    </AccessBanner>
  );
}
