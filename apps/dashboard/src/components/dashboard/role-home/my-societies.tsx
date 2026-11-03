import Link from "next/link";

import type { HomeSocietyList } from "@sarvodaya-connect/api-contracts";

import { endsLabel, type SocietyFilters as HomeSocietyFilters, updatedLabel } from "@/lib/home-format";

import { EmptyState, secondaryButtonClass } from "../data-states";
import { GradeBadge } from "../grade-queue/grade-badge";
import { Icon } from "../icon";
import { AccessBanner } from "../ui/access-banner";
import { AccessEndedBanner, PendingGradeChip, TemporaryViewBanner } from "./role-home";

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

function AccessCell({ editable, yours }: { editable: boolean; yours: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {editable ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success-text">
          <Icon className="size-3" name="check" strokeWidth={2.4} />
          Editable
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-[#f0f1ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#56615a]">
          <Icon className="size-3" name="lock" strokeWidth={2.2} />
          View only
        </span>
      )}
      {yours && <span className="rounded-pill bg-warn-bg px-2 py-0.5 text-[10px] font-semibold text-warn-text">Yours</span>}
    </span>
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
export function MySocieties({
  list,
  filters,
  role,
  now = new Date(),
}: {
  list: HomeSocietyList;
  filters: HomeSocietyFilters;
  role?: "PROGRAMME_COORDINATOR" | "DEPUTY_DISTRICT_MANAGER" | "DISTRICT_MANAGER";
  now?: Date;
}) {
  const isDm = list.viewOnly;
  const isDdm = role === "DEPUTY_DISTRICT_MANAGER";
  const districtScope = list.scope === "DISTRICT";
  const showSpc = isDm || isDdm;
  const district = list.district?.name ?? "district";
  const { page, totalItems, totalPages, pageSize } = list.meta;
  const from = totalItems ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, totalItems);
  const filtered = Object.entries(filters).some(([key, value]) => value && key !== "page" && key !== "scope");
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">{isDm || isDdm ? "Societies" : "My societies"}</h1>
        <p className="text-[12.5px] text-ink-soft">
          {isDm
            ? `All ${list.scopeTotal} societies in ${district}`
            : districtScope && list.access
              ? `All ${list.scopeTotal} ${district} societies · view only until ${endsLabel(list.access.expiresAt)}`
              : isDdm
                ? `Your ${list.tabs.mine} assigned ${list.tabs.mine === 1 ? "society" : "societies"}`
                : `${list.scopeTotal} ${list.scopeTotal === 1 ? "society" : "societies"} assigned to you by HQ`}
        </p>
      </div>

      {list.recentlyEnded && <AccessEndedBanner assigned={list.tabs.mine} ended={list.recentlyEnded} />}
      {districtScope && list.access ? (
        <TemporaryViewBanner grant={list.access} now={now} />
      ) : (
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
      )}

      {isDdm && (
        <nav aria-label="Which societies" className="flex gap-1 border-b border-line">
          {[
            { href: "/my-societies", label: "My societies · edit", count: list.tabs.mine, active: !districtScope },
            ...(list.tabs.district !== null
              ? [{ href: "/my-societies?scope=DISTRICT", label: `${district} district · view only`, count: list.tabs.district, active: districtScope }]
              : []),
          ].map((tab) => (
            <Link
              aria-current={tab.active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold ${tab.active ? "border-brand-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
              href={tab.href}
              key={tab.href}
            >
              {tab.label}
              <span className="rounded-pill bg-surface-muted px-1.5 text-[10.5px]">{tab.count}</span>
            </Link>
          ))}
        </nav>
      )}

      <form action="/my-societies" className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3" role="search">
        {districtScope && <input name="scope" type="hidden" value="DISTRICT" />}
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
        {districtScope && (
          <Select
            label="Assigned to me"
            name="assignedToMe"
            options={[
              { value: "", label: "Assigned to me: Any" },
              { value: "true", label: "Mine" },
              { value: "false", label: "Not mine" },
            ]}
            value={filters.assignedToMe}
          />
        )}
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
          <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href={districtScope ? "/my-societies?scope=DISTRICT" : "/my-societies"}>
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
                  ) : showSpc ? (
                    <th className={th} scope="col">SPC</th>
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
                    ) : showSpc ? (
                      <td className="px-3 py-3 text-[12.5px] text-ink">{row.spcName ?? <span className="text-ink-soft">Not assigned</span>}</td>
                    ) : (
                      <td className="px-3 py-3 text-[12.5px] text-ink">{row.officerName ?? <span className="text-ink-soft">Not assigned</span>}</td>
                    )}
                    <td className={`px-3 py-3 text-[12.5px] ${row.stale ? "font-semibold text-danger-text" : "text-ink"}`}>
                      {updatedLabel(row.updatedAt, now)}
                      {row.stale && <span className="sr-only"> (not updated for 90 days or more)</span>}
                    </td>
                    {!isDm && (
                      <td className="px-3 py-3">
                        <AccessCell editable={row.editable} yours={row.yours} />
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
              {isDm || districtScope ? ` in ${district}` : ` assigned ${totalItems === 1 ? "society" : "societies"}`}
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
        ) : districtScope ? (
          <span>
            Your own {list.tabs.mine} {list.tabs.mine === 1 ? "society stays" : "societies stay"} editable and {list.tabs.mine === 1 ? "is" : "are"} marked &quot;Yours&quot;. All others
            open view only, and each one you open is recorded in the access history.
          </span>
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
