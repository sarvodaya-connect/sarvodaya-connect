import Link from "next/link";

import type { SocietyRecord } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { Pill } from "../ui/pill";
import { formatDate, gradeBadgeClass } from "@/lib/society-record-format";

import { RecordTabs, type RecordTab } from "./record-tabs";

function isToday(value: string) {
  return formatDate(value) === formatDate(new Date().toISOString());
}

/** D05 breadcrumb, society header and actions shared by every record tab. */
export function RecordHeader({ record, tabs }: { record: SocietyRecord; tabs: RecordTab[] }) {
  const base = `/societies/${record.id}`;
  const location = [record.societyCode, record.district.nameEn, record.address.dsDivision && `${record.address.dsDivision} DS`]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
        <Link className="text-[#2d5c88] underline underline-offset-2" href="/societies">Societies</Link>
        <span aria-hidden="true">›</span>
        <span>{record.district.nameEn}</span>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{record.nameEn}</span>
      </nav>

      <section className="mb-4 mt-3 rounded-card border border-line bg-surface px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-label={record.grade ? `Grade ${record.grade}` : "Grade not set"}
              className={`grid size-10 shrink-0 place-items-center rounded-lg text-base font-bold ${
                record.grade ? gradeBadgeClass[record.grade] : "bg-[#eef1ec] text-muted"
              }`}
            >
              {record.grade ?? "–"}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] font-bold tracking-[-0.015em] text-ink">{record.nameEn}</h2>
                <Pill tone={record.status === "ACTIVE" ? "on-time" : "inactive"}>
                  <span className="capitalize">{record.status.replaceAll("_", " ").toLowerCase()}</span>
                </Pill>
                {record.openGradeRequest && (
                  <Pill tone="fast-target">
                    Grade request {record.openGradeRequest.fromGrade ?? "–"} → {record.openGradeRequest.toGrade}
                  </Pill>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {record.nameLocal && <span className="text-ink-soft">{record.nameLocal} · </span>}
                {location}
              </p>
              {record.lastChange && (
                <p className="text-[11px] text-muted">
                  last changed {isToday(record.lastChange.at) ? "today" : formatDate(record.lastChange.at)} by{" "}
                  {record.lastChange.by.displayName}
                </p>
              )}
            </div>
          </div>
          {record.permissions.canEdit && (
            <Link
              className="inline-flex items-center gap-2 self-start rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft lg:self-center"
              href={`${base}?panel=edit`}
            >
              <Icon className="size-3.5" name="clipboard" />
              Edit society
            </Link>
          )}
        </div>
      </section>

      <RecordTabs tabs={tabs} />
    </>
  );
}
