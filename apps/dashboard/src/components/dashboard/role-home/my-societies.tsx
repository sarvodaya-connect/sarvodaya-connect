import Link from "next/link";

import type { HomeSocietyList } from "@sarvodaya-connect/api-contracts";

import { ENGLISH } from "@/i18n/english";
import type { Translator } from "@/i18n/translate";
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

function AccessCell({ editable, t, yours }: { editable: boolean; t: Translator; yours: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {editable ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success-text">
          <Icon className="size-3" name="check" strokeWidth={2.4} />
          {t("home.editable")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-[#f0f1ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#56615a]">
          <Icon className="size-3" name="lock" strokeWidth={2.2} />
          {t("home.viewOnly")}
        </span>
      )}
      {yours && <span className="rounded-pill bg-warn-bg px-2 py-0.5 text-[10px] font-semibold text-warn-text">{t("ms.yours")}</span>}
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
  t = ENGLISH,
}: {
  list: HomeSocietyList;
  filters: HomeSocietyFilters;
  role?: "PROGRAMME_COORDINATOR" | "DEPUTY_DISTRICT_MANAGER" | "DISTRICT_MANAGER";
  now?: Date;
  t?: Translator;
}) {
  const isDm = list.viewOnly;
  const isDdm = role === "DEPUTY_DISTRICT_MANAGER";
  const districtScope = list.scope === "DISTRICT";
  const showSpc = isDm || isDdm;
  const district = list.district?.name ?? t("home.districtWord");
  const { page, totalItems, totalPages, pageSize } = list.meta;
  const from = totalItems ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, totalItems);
  const filtered = Object.entries(filters).some(([key, value]) => value && key !== "page" && key !== "scope");
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">{isDm || isDdm ? t("home.societies") : t("home.mySocieties")}</h1>
        <p className="text-[12.5px] text-ink-soft">
          {isDm
            ? t("ms.allIn", { count: list.scopeTotal, district })
            : districtScope && list.access
              ? t("ms.allViewOnly", { count: list.scopeTotal, district, date: endsLabel(list.access.expiresAt, t) })
              : isDdm
                ? t.plural("ms.yourAssigned", list.tabs.mine)
                : t.plural("ms.assignedByHq", list.scopeTotal)}
        </p>
      </div>

      {list.recentlyEnded && <AccessEndedBanner assigned={list.tabs.mine} ended={list.recentlyEnded} t={t} />}
      {districtScope && list.access ? (
        <TemporaryViewBanner grant={list.access} now={now} t={t} />
      ) : (
      <AccessBanner tone={isDm ? "viewOnly" : "edit"}>
        {isDm ? (
          t.rich("ms.accessDm", { scope: <strong>{t("ms.accessDmScope", { count: list.scopeTotal, district })}</strong> })
        ) : (
          t.rich("ms.accessEdit", { scope: <strong>{t.plural("home.assigned", list.scopeTotal)}</strong> })
        )}
      </AccessBanner>
      )}

      {isDdm && (
        <nav aria-label={t("ms.which")} className="flex gap-1 border-b border-line">
          {[
            { href: "/my-societies", label: t("ms.tabMine"), count: list.tabs.mine, active: !districtScope },
            ...(list.tabs.district !== null
              ? [{ href: "/my-societies?scope=DISTRICT", label: t("ms.tabDistrict", { district }), count: list.tabs.district, active: districtScope }]
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
          <span className="sr-only">{t("s.nameOrNumber")}</span>
          <Icon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6a776e]" name="search" strokeWidth={2} />
          <input className={`${field} w-full pl-8`} defaultValue={filters.q ?? ""} name="q" placeholder={t("s.nameOrNumber")} type="search" />
        </label>
        {isDm && (
          <Select
            label={t("s.filterDs")}
            name="dsDivision"
            options={[{ value: "", label: t("ms.dsAll") }, ...list.options.dsDivisions.map((d) => ({ value: d, label: d }))]}
            value={filters.dsDivision}
          />
        )}
        <Select
          label={t("home.grade")}
          name="grade"
          options={[{ value: "", label: t("s.gradeAll") }, { value: "A", label: t("n.gradeOf", { grade: "A" }) }, { value: "B", label: t("n.gradeOf", { grade: "B" }) }, { value: "C", label: t("n.gradeOf", { grade: "C" }) }]}
          value={filters.grade}
        />
        {!isDm && (
          <Select
            label={t("s.filterDs")}
            name="dsDivision"
            options={[{ value: "", label: t("ms.dsAll") }, ...list.options.dsDivisions.map((d) => ({ value: d, label: d }))]}
            value={filters.dsDivision}
          />
        )}
        {isDm && (
          <>
            <Select label={t("s.filterSpc")} name="spcId" options={[{ value: "", label: t("s.spcAny") }, ...list.options.spcs.map((p) => ({ value: p.id, label: p.name }))]} value={filters.spcId} />
            <Select label="DDM" name="ddmId" options={[{ value: "", label: t("ms.ddmAny") }, ...list.options.ddms.map((p) => ({ value: p.id, label: p.name }))]} value={filters.ddmId} />
          </>
        )}
        <Select
          label={isDm ? t("s.filterRecords") : t("ms.needsUpdate")}
          name="needsUpdate"
          options={[
            { value: "", label: isDm ? t("s.recordsAny") : t("ms.needsUpdateAny") },
            { value: "true", label: t("ms.notUpdated90") },
            { value: "false", label: t("ms.updated90") },
          ]}
          value={filters.needsUpdate}
        />
        {districtScope && (
          <Select
            label={t("ms.assignedToMe")}
            name="assignedToMe"
            options={[
              { value: "", label: t("ms.assignedAny") },
              { value: "true", label: t("ms.mine") },
              { value: "false", label: t("ms.notMine") },
            ]}
            value={filters.assignedToMe}
          />
        )}
        <Select
          label={t("s.filterRequest")}
          name="gradeRequest"
          options={[
            { value: "", label: t("s.requestAny") },
            { value: "PENDING", label: t("ms.waitingHq") },
            { value: "NONE", label: t("ms.noRequest") },
          ]}
          value={filters.gradeRequest}
        />
        <button className="h-9 rounded-button bg-brand-action px-3.5 text-[12px] font-semibold text-white hover:bg-brand-action-pressed" type="submit">
          {t("r.apply")}
        </button>
        {filtered && (
          <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href={districtScope ? "/my-societies?scope=DISTRICT" : "/my-societies"}>
            {t("s.clearFilters")}
          </Link>
        )}
      </form>

      {list.data.length === 0 ? (
        filtered ? (
          <EmptyState
            action={
              <Link className={secondaryButtonClass} href="/my-societies">
                {t("s.clearFilters")}
              </Link>
            }
            description={t("ms.changeFilters")}
            icon="search"
            title={t("ms.noMatchFilters")}
          />
        ) : (
          <EmptyState
            description={isDm ? t("ms.noneInDistrict", { district }) : t("ms.hqAssigns")}
            icon="society"
            title={isDm ? t("ms.noSocieties") : t("ms.noneAssigned")}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface-muted">
                <tr>
                  <th className={th} scope="col">{t("s.sNumber")}</th>
                  <th className={th} scope="col">{t("home.society")}</th>
                  <th className={th} scope="col">{t("home.grade")}</th>
                  <th className={th} scope="col">{t("nav.membersShort")}</th>
                  {isDm ? (
                    <>
                      <th className={th} scope="col">{t("s.filterSpc")}</th>
                      <th className={th} scope="col">DDM</th>
                    </>
                  ) : showSpc ? (
                    <th className={th} scope="col">{t("s.filterSpc")}</th>
                  ) : (
                    <th className={th} scope="col">{t("home.societyOfficer")}</th>
                  )}
                  <th className={th} scope="col">{t("s.updated")}</th>
                  {!isDm && <th className={th} scope="col">{t("home.yourAccessHead")}</th>}
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
                        {row.pendingGrade && <PendingGradeChip pending={row.pendingGrade} t={t} />}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-ink">{row.members?.toLocaleString("en-GB") ?? t("ms.notRecorded")}</td>
                    {isDm ? (
                      <>
                        <td className="px-3 py-3 text-[12.5px] text-ink">{row.spcName ?? <span className="text-ink-soft">{t("home.notAssigned")}</span>}</td>
                        <td className="px-3 py-3 text-[12.5px] text-ink">{row.ddmName ?? <span className="text-ink-soft">{t("home.notAssigned")}</span>}</td>
                      </>
                    ) : showSpc ? (
                      <td className="px-3 py-3 text-[12.5px] text-ink">{row.spcName ?? <span className="text-ink-soft">{t("home.notAssigned")}</span>}</td>
                    ) : (
                      <td className="px-3 py-3 text-[12.5px] text-ink">{row.officerName ?? <span className="text-ink-soft">{t("home.notAssigned")}</span>}</td>
                    )}
                    <td className={`px-3 py-3 text-[12.5px] ${row.stale ? "font-semibold text-danger-text" : "text-ink"}`}>
                      {updatedLabel(row.updatedAt, now, t)}
                      {row.stale && <span className="sr-only"> {t("ms.staleNote")}</span>}
                    </td>
                    {!isDm && (
                      <td className="px-3 py-3">
                        <AccessCell editable={row.editable} t={t} yours={row.yours} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line-soft px-4 py-2.5 text-[11.5px] text-ink-soft">
            <span>
              {isDm || districtScope ? t("s.showingIn", { from, to, total: totalItems, district }) : t.plural("ms.showingAssigned", totalItems, { from, to })}
            </span>
            {totalPages > 1 && (
              <nav aria-label={t("ms.pages")} className="flex items-center gap-2">
                {page > 1 && (
                  <Link className="font-semibold text-brand-forest" href={pageHref(filters, page - 1)}>
                    ‹ {t("n.previous")}
                  </Link>
                )}
                <span>{t("n.pageOf", { page, totalPages })}</span>
                {page < totalPages && (
                  <Link className="font-semibold text-brand-forest" href={pageHref(filters, page + 1)}>
                    {t("n.next")} ›
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
          <span>{t("ms.helpDm")}</span>
        ) : districtScope ? (
          <span>{t.plural("ms.helpDistrict", list.tabs.mine)}</span>
        ) : (
          <span>
            <strong className="block text-ink">{t("ms.whyTitle")}</strong>
            {t("ms.whyBody", { district })}
          </span>
        )}
      </p>
    </div>
  );
}
