import Link from "next/link";

import type { DirectoryView } from "@sarvodaya-connect/api-contracts";

import { primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { GradeBadge, GradeLine } from "@/components/dashboard/national/parts";
import { Pagination } from "@/components/dashboard/national/links";
import { count, first } from "@/components/dashboard/national/format";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import { Pill } from "@/components/dashboard/ui/pill";
import type { MessageKey } from "@/i18n/messages/en";
import { getT } from "@/i18n/server";
import { localeTag, type Translator } from "@/i18n/translate";
import { getCurrentViewer } from "@/lib/current-viewer";
import { type DirectoryFilters, getDistrictOptions, getSocietyDirectory } from "@/lib/national-api";
import { isDemoMode, platformApi } from "@/lib/platform-api";

const VIEWS: { key: DirectoryView; label: MessageKey }[] = [
  { key: "all", label: "s.viewAll" },
  { key: "not-updated", label: "s.viewNotUpdated" },
  { key: "figures-not-added", label: "s.viewFigures" },
  { key: "audit-past-due", label: "s.viewAudit" },
];

const FILTER_KEYS = ["q", "districtId", "dsDivision", "grade", "spcId", "records", "gradeRequest"] as const;

const FILTER_LABELS: Record<(typeof FILTER_KEYS)[number], MessageKey> = {
  q: "s.filterSearch",
  districtId: "mb.district",
  dsDivision: "s.filterDs",
  grade: "home.grade",
  spcId: "s.filterSpc",
  records: "s.filterRecords",
  gradeRequest: "s.filterRequest",
};

const selectClass = "rounded-button border border-line bg-surface px-3 py-2 text-[12px]";

function updatedLabel(value: string, t: Translator) {
  const date = new Date(value);
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" });
  if (date.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" }) === today) return t("home.today");
  return date.toLocaleDateString(localeTag(t.locale), { day: "2-digit", month: "short", timeZone: "Asia/Colombo" });
}

/** SPCs for the filter. The accounts list is HQ only; a failure leaves the filter out. */
async function spcOptions(): Promise<{ id: string; displayName: string }[]> {
  try {
    const result = await platformApi("/identity/accounts");
    return (result.data ?? []).filter((account: { role: string }) => account.role === "PROGRAMME_COORDINATOR");
  } catch {
    return [];
  }
}

/** V5 D04 Societies: search and filter every society (HQ). The API applies each user's scope. */
export default async function SocietiesPage({ searchParams }: PageProps<"/societies">) {
  await getCurrentViewer();
  const t = await getT();
  const params = await searchParams;
  const view = (VIEWS.find((item) => item.key === first(params.view))?.key ?? "all") as DirectoryView;
  const page = Math.max(1, Number(first(params.page)) || 1);
  const filters: DirectoryFilters = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, first(params[key])?.trim() || undefined]),
  );
  const [directory, districts, spcs] = await Promise.all([
    getSocietyDirectory({ ...filters, view, page }),
    getDistrictOptions(),
    spcOptions(),
  ]);
  const href = (changes: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, view, page: undefined, ...changes }))
      if (value !== undefined && value !== "" && !(key === "view" && value === "all")) search.set(key, String(value));
    const text = search.toString();
    return text ? `/societies?${text}` : "/societies";
  };
  const district = districts.find((item) => item.id === filters.districtId);
  const active = FILTER_KEYS.filter((key) => filters[key]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">{t("home.societies")}</h1>
          <p className="text-[12px] text-ink-soft">
            {district ? t("s.activeIn", { count: count(directory.views.all), district: district.nameEn }) : t("n.activeSocietiesCount", { count: count(directory.views.all) })} · <GradeLine grades={directory.grades} />
            {isDemoMode() && <span className="ml-2"><Pill tone="preview">{t("n.demoData")}</Pill></span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={secondaryButtonClass} href={`/reports?type=society-status${filters.districtId ? `&districtId=${filters.districtId}` : ""}`}>
            {t("s.report")}
          </Link>
          <Link className={primaryButtonClass} href="/societies/new">
            <Icon className="size-4" name="personAdd" strokeWidth={2} />
            {t("s.create")}
          </Link>
        </div>
      </div>

      <nav aria-label={t("s.lists")} className="mt-4 flex flex-wrap gap-1 border-b border-line">
        {VIEWS.map((item) => (
          <Link
            aria-current={item.key === view ? "page" : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold ${
              item.key === view ? "border-brand-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
            href={href({ view: item.key })}
            key={item.key}
          >
            {t(item.label)}
            <span className="rounded-full bg-[#eef0eb] px-1.5 text-[10px] text-muted">{count(directory.views[item.key])}</span>
          </Link>
        ))}
      </nav>

      <form className="mt-3 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3" method="get" role="search">
        {view !== "all" && <input name="view" type="hidden" value={view} />}
        <label className="sr-only" htmlFor="society-search">{t("s.nameOrNumber")}</label>
        <input className="w-56 rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={filters.q} id="society-search" name="q" placeholder={t("s.nameOrNumber")} />
        <label className="sr-only" htmlFor="filter-district">{t("mb.district")}</label>
        <select className={selectClass} defaultValue={filters.districtId ?? ""} id="filter-district" name="districtId">
          <option value="">{t("s.districtAll")}</option>
          {districts.map((item) => <option key={item.id} value={item.id}>{t("s.districtOf", { name: item.nameEn })}</option>)}
        </select>
        <label className="sr-only" htmlFor="filter-ds">{t("s.dsDivision")}</label>
        <input className="w-40 rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={filters.dsDivision} id="filter-ds" name="dsDivision" placeholder={t("s.dsAll")} />
        <label className="sr-only" htmlFor="filter-grade">{t("home.grade")}</label>
        <select className={selectClass} defaultValue={filters.grade ?? ""} id="filter-grade" name="grade">
          <option value="">{t("s.gradeAll")}</option>
          <option value="A">{t("s.gradeOf", { grade: "A" })}</option>
          <option value="B">{t("s.gradeOf", { grade: "B" })}</option>
          <option value="C">{t("s.gradeOf", { grade: "C" })}</option>
          <option value="NONE">{t("s.gradeNotSet")}</option>
        </select>
        {spcs.length > 0 && (
          <>
            <label className="sr-only" htmlFor="filter-spc">{t("s.filterSpc")}</label>
            <select className={selectClass} defaultValue={filters.spcId ?? ""} id="filter-spc" name="spcId">
              <option value="">{t("s.spcAny")}</option>
              {spcs.map((spc) => <option key={spc.id} value={spc.id}>{t("s.spcOf", { name: spc.displayName })}</option>)}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="filter-records">{t("s.filterRecords")}</label>
        <select className={selectClass} defaultValue={filters.records ?? ""} id="filter-records" name="records">
          <option value="">{t("s.recordsAny")}</option>
          <option value="recent">{t("s.recordsRecent")}</option>
          <option value="stale">{t("s.recordsStale")}</option>
        </select>
        <label className="sr-only" htmlFor="filter-request">{t("s.gradeRequest")}</label>
        <select className={selectClass} defaultValue={filters.gradeRequest ?? ""} id="filter-request" name="gradeRequest">
          <option value="">{t("s.requestAny")}</option>
          <option value="waiting">{t("s.requestWaiting")}</option>
          <option value="none">{t("s.requestNone")}</option>
        </select>
        <button className={secondaryButtonClass} type="submit">{t("r.apply")}</button>
        {active.length > 0 && (
          <Link className="text-[11px] font-semibold text-brand-forest underline" href={view === "all" ? "/societies" : `/societies?view=${view}`}>
            {t("s.clearFilters")}
          </Link>
        )}
      </form>

      <div className="mt-3">
        {directory.data.length === 0 ? (
          <section className="rounded-card border border-line bg-surface px-6 py-10 text-center" role="status">
            <Icon className="mx-auto size-8 text-brand-forest" name="search" />
            <h2 className="mt-2 text-[16px] font-bold text-ink">{t("s.noMatch")}</h2>
            <p className="mt-1 text-[12px] text-ink-soft">{t("s.noMatchHelp")}</p>
            {active.length > 0 && (
              <ul aria-label={t("s.activeFilters")} className="mt-3 flex flex-wrap justify-center gap-2">
                {active.map((key) => (
                  <li key={key}>
                    <Link aria-label={t("s.removeFilter", { filter: t(FILTER_LABELS[key]) })} className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe0d1] bg-brand-mint-soft px-3 py-1 text-[11px] text-[#2f4a39]" href={href({ [key]: undefined })}>
                      <strong>{t(FILTER_LABELS[key])}:</strong> {key === "districtId" ? district?.nameEn : key === "spcId" ? spcs.find((spc) => spc.id === filters.spcId)?.displayName : filters[key]}
                      <Icon className="size-3" name="close" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link className={`${primaryButtonClass} mt-4`} href={view === "all" ? "/societies" : `/societies?view=${view}`}>{t("s.clearAll")}</Link>
          </section>
        ) : (
          <DataTable>
            <caption className="sr-only">{t("home.societies")}</caption>
            <Thead>
              <tr>
                {[t("s.sNumber"), t("home.society"), t("mb.district"), t("home.grade"), t("nav.membersShort"), t("s.filterSpc"), t("s.officerAccount"), t("s.updated")].map((heading) => (
                  <Th key={heading} scope="col">{heading}</Th>
                ))}
              </tr>
            </Thead>
            <Tbody>
              {directory.data.map((society) => (
                <Tr key={society.id}>
                  <Td className="whitespace-nowrap text-ink-soft">{society.societyCode}</Td>
                  <Td>
                    <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/societies/${society.id}`}>{society.name}</Link>
                    {society.nameLocal && <span className="block text-[10px] text-muted">{society.nameLocal}</span>}
                    {/* A new society's Exco is entered by its Society Officer after HQ creates it. */}
                    {society.excoComplete === false && (
                      <span className="mt-0.5 block">
                        <Pill tone="fast-target">
                          {society.excoSeatsFilled === 0
                            ? t("s.excoNone")
                            : society.excoSeatsFilled < 25
                              ? t("s.excoSeats", { count: society.excoSeatsFilled })
                              : society.excoMissingOffices?.length
                                ? t("s.excoMissing", { offices: society.excoMissingOffices.join(", ") })
                                : t("s.excoCheck")}
                        </Pill>
                      </span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">{society.district.name}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <GradeBadge grade={society.grade} />
                      {society.requestedGrade && <Pill tone="fast-target">{t("s.requested", { from: society.grade ?? "–", to: society.requestedGrade })}</Pill>}
                    </span>
                  </Td>
                  <Td className="text-ink">{society.members === null ? "—" : count(society.members)}</Td>
                  <Td className="text-ink-soft">{society.spc?.name ?? t("home.notAssigned")}</Td>
                  <Td>
                    {society.societyOfficer ? (
                      <span className="flex flex-wrap items-center gap-1.5 text-ink">
                        {society.societyOfficer.name}
                        <Pill tone={society.societyOfficer.status === "ACTIVE" ? "on-time" : "fast-target"}>
                          {society.societyOfficer.status === "ACTIVE" ? t("home.active") : t("s.pending")}
                        </Pill>
                      </span>
                    ) : (
                      <span className="text-muted">{t("home.notAssigned")}</span>
                    )}
                  </Td>
                  <Td className={society.notUpdatedIn90Days ? "font-semibold text-[#a8312a]" : "text-ink-soft"}>
                    {updatedLabel(society.updatedAt, t)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </DataTable>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span>
            {t(district ? "s.showingIn" : "s.showing", {
              from: directory.data.length ? (page - 1) * directory.meta.pageSize + 1 : 0,
              to: (page - 1) * directory.meta.pageSize + directory.data.length,
              total: count(directory.meta.totalItems),
              district: district?.nameEn ?? "",
            })}
          </span>
          <Pagination href={(target) => href({ page: target })} page={page} totalPages={directory.meta.totalPages} />
        </div>
      </div>
    </>
  );
}
