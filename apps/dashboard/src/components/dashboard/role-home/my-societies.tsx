import Link from "next/link";

import type { HomeSocietyList } from "@sarvodaya-connect/api-contracts";

import { type SocietyFilters as HomeSocietyFilters, updatedLabel } from "@/lib/home-format";

import { EmptyState, secondaryButtonClass } from "../data-states";
import { GradeBadge } from "../grade-queue/grade-badge";
import { Icon } from "../icon";
import { AccessBanner } from "../ui/access-banner";
import { PendingGradeChip } from "./role-home";

const field =
  "h-9 rounded-input border border-line bg-surface px-2.5 text-[12px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

function Select({ label, name, value, options }: { label: string; name: keyof HomeSocietyFilters; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-1.5 text-[12px] text-ink">
      <span className="sr-only">{label}</span>
      <select aria-label={label} className={field} defaultValue={value ?? ""} name={name}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function pageHref(filters: HomeSocietyFilters, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && key !== "page") query.set(key, value);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return `/my-societies${text ? `?${text}` : ""}`;
}

/**
 * V5 SP02 (SPC), DD03 (DDM) and DM02 (DM). The API lists only the societies
 * the user covers; the DM's district list is view only.
 */
export function MySocieties({ list, filters, now = new Date() }: { list: HomeSocietyList; filters: HomeSocietyFilters; now?: Date }) {
  const isDm = list.viewOnly;
  const district = list.district?.name ?? "district";
  const { page, totalItems, totalPages, pageSize } = list.meta;
  const from = totalItems ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, totalItems);
  const filtered = Object.entries(filters).some(([key, value]) => value && key !== "page");
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">{isDm ? "Societies" : "My societies"}</h1>
        <p className="text-[12.5px] text-ink-soft">
          {isDm ? `All ${list.scopeTotal} societies in ${district}` : `${list.scopeTotal} ${list.scopeTotal === 1 ? "society" : "societies"} assigned to you by HQ`}
        </p>
      </div>

      <AccessBanner tone={isDm ? "viewOnly" : "edit"}>
        {isDm ? (
          <>
            Your access: <strong>all {list.scopeTotal} {district} societies · view only</strong>. You cannot edit society information or request, approve or change grades.
          </>
        ) : (
          <>
            Your access: <strong>{list.scopeTotal} assigned {list.scopeTotal === 1 ? "society" : "societies"}</strong> · view and edit. Grade changes are decided by HQ.
          </>
        )}
      </AccessBanner>

      <form action="/my-societies" className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3" role="search">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Name or S number</span>
          <Icon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6a776e]" name="search" strokeWidth={2} />
          <input className={`${field} w-full pl-8`} defaultValue={filters.q ?? ""} name="q" placeholder="Name or S number" type="search" />
        </label>
        {isDm && (
          <Select
            label="DS division"
            name="dsDivision"
            options={[{ value: "", label: "DS division: All" }, ...list.options.dsDivisions.map((d) => ({ value: d, label: d }))]}
            value={filters.dsDivision}
          />
        )}
        <Select
          label="Grade"
          name="grade"
          options={[{ value: "", label: "Grade: All" }, { value: "A", label: "Grade A" }, { value: "B", label: "Grade B" }, { value: "C", label: "Grade C" }]}
          value={filters.grade}
        />
        {!isDm && (
          <Select
            label="DS division"
            name="dsDivision"
            options={[{ value: "", label: "DS division: All" }, ...list.options.dsDivisions.map((d) => ({ value: d, label: d }))]}
            value={filters.dsDivision}
          />
        )}
        {isDm && (
          <>
            <Select label="SPC" name="spcId" options={[{ value: "", label: "SPC: Any" }, ...list.options.spcs.map((p) => ({ value: p.id, label: p.name }))]} value={filters.spcId} />
            <Select label="DDM" name="ddmId" options={[{ value: "", label: "DDM: Any" }, ...list.options.ddms.map((p) => ({ value: p.id, label: p.name }))]} value={filters.ddmId} />
          </>
        )}
        <Select
          label={isDm ? "Records" : "Needs update"}
          name="needsUpdate"
          options={[
            { value: "", label: isDm ? "Records: Any" : "Needs update: Any" },
            { value: "true", label: "Not updated 90+ days" },
            { value: "false", label: "Updated in 90 days" },
          ]}
          value={filters.needsUpdate}
        />
        <Select
          label="Grade request"
          name="gradeRequest"
          options={[
            { value: "", label: "Grade request: Any" },
            { value: "PENDING", label: "Waiting for HQ" },
            { value: "NONE", label: "No request" },
          ]}
          value={filters.gradeRequest}
        />
        <button className="h-9 rounded-button bg-brand-action px-3.5 text-[12px] font-semibold text-white hover:bg-brand-action-pressed" type="submit">
          Apply
        </button>
        {filtered && (
          <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/my-societies">
            Clear filters
          </Link>
        )}
      </form>

      {list.data.length === 0 ? (
        filtered ? (
          <EmptyState
            action={
              <Link className={secondaryButtonClass} href="/my-societies">
                Clear filters
              </Link>
            }
            description="Change or clear the filters to see more societies."
            icon="search"
            title="No societies match these filters"
          />
        ) : (
          <EmptyState
            description={isDm ? `No societies are recorded in ${district} yet.` : "HQ assigns societies to you. They appear here as soon as they are assigned."}
            icon="society"
            title={isDm ? "No societies yet" : "No societies assigned yet"}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface-muted">
                <tr>
                  <th className={th} scope="col">S number</th>
                  <th className={th} scope="col">Society</th>
                  <th className={th} scope="col">Grade</th>
                  <th className={th} scope="col">Members</th>
                  {isDm ? (
                    <>
                      <th className={th} scope="col">SPC</th>
                      <th className={th} scope="col">DDM</th>
                    </>
                  ) : (
                    <th className={th} scope="col">Society Officer</th>
                  )}
                  <th className={th} scope="col">Updated</th>
                  {!isDm && <th className={th} scope="col">Your access</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {list.data.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-3 text-[12.5px] text-ink">{row.societyCode}</td>
                    <td className="px-3 py-3 text-[12.5px]">
                      <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/societies/${row.id}`}>
                        {row.nameEn}
                      </Link>
                      {row.nameLocal && <span className="block text-[10.5px] text-ink-soft">{row.nameLocal}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <GradeBadge grade={row.grade} />
                        {row.pendingGrade && <PendingGradeChip pending={row.pendingGrade} />}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-ink">{row.members?.toLocaleString("en-GB") ?? "Not recorded"}</td>
                    {isDm ? (
                      <>
                        <td className="px-3 py-3 text-[12.5px] text-ink">{row.spcName ?? <span className="text-ink-soft">Not assigned</span>}</td>
                        <td className="px-3 py-3 text-[12.5px] text-ink">{row.ddmName ?? <span className="text-ink-soft">Not assigned</span>}</td>
                      </>
                    ) : (
                      <td className="px-3 py-3 text-[12.5px] text-ink">{row.officerName ?? <span className="text-ink-soft">Not assigned</span>}</td>
                    )}
                    <td className={`px-3 py-3 text-[12.5px] ${row.stale ? "font-semibold text-danger-text" : "text-ink"}`}>
                      {updatedLabel(row.updatedAt, now)}
                      {row.stale && <span className="sr-only"> (not updated for 90 days or more)</span>}
                    </td>
                    {!isDm && (
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success-text">
                          <Icon className="size-3" name="check" strokeWidth={2.4} />
                          Editable
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line-soft px-4 py-2.5 text-[11.5px] text-ink-soft">
            <span>
              Showing {from}–{to} of {totalItems}
              {isDm ? ` in ${district}` : ` assigned ${totalItems === 1 ? "society" : "societies"}`}
            </span>
            {totalPages > 1 && (
              <nav aria-label="Pages" className="flex items-center gap-2">
                {page > 1 && (
                  <Link className="font-semibold text-brand-forest" href={pageHref(filters, page - 1)}>
                    ‹ Previous
                  </Link>
                )}
                <span>
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link className="font-semibold text-brand-forest" href={pageHref(filters, page + 1)}>
                    Next ›
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      )}

      <p className="flex items-start gap-2.5 rounded-card border border-line bg-surface-muted px-4 py-3 text-[12px] text-ink-soft">
        <Icon className="mt-0.5 size-4 shrink-0" name="help" />
        {isDm ? (
          <span>Every society opens view only. To change a record, ask its SPC or DDM; grade decisions are made by HQ.</span>
        ) : (
          <span>
            <strong className="block text-ink">Why can&apos;t I see other societies?</strong>
            Only the societies HQ has assigned to you are listed. Other societies in {district} do not appear in search.
          </span>
        )}
      </p>
    </div>
  );
}
