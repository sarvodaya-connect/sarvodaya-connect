import Link from "next/link";

import type { DirectoryView } from "@sarvodaya-connect/api-contracts";

import { primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { GradeBadge, GradeLine, Pagination, count, first } from "@/components/dashboard/national/parts";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import { Pill } from "@/components/dashboard/ui/pill";
import { getCurrentViewer } from "@/lib/current-viewer";
import { type DirectoryFilters, getDistrictOptions, getSocietyDirectory } from "@/lib/national-api";
import { isDemoMode, platformApi } from "@/lib/platform-api";

const VIEWS: { key: DirectoryView; label: string }[] = [
  { key: "all", label: "All societies" },
  { key: "not-updated", label: "Not updated in 90+ days" },
  { key: "figures-not-added", label: "Yearly figures not added" },
  { key: "audit-past-due", label: "Audit report past due" },
];

const FILTER_KEYS = ["q", "districtId", "dsDivision", "grade", "spcId", "records", "gradeRequest"] as const;

const FILTER_LABELS: Record<(typeof FILTER_KEYS)[number], string> = {
  q: "Search",
  districtId: "District",
  dsDivision: "DS division",
  grade: "Grade",
  spcId: "SPC",
  records: "Records",
  gradeRequest: "Grade request",
};

const selectClass = "rounded-button border border-line bg-surface px-3 py-2 text-[12px]";

function updatedLabel(value: string) {
  const date = new Date(value);
  const today = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" });
  if (date.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" }) === today) return "Today";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Colombo" });
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
          <h1 className="text-[22px] font-bold text-ink">Societies</h1>
          <p className="text-[12px] text-ink-soft">
            {count(directory.views.all)} active societies{district ? ` in ${district.nameEn}` : ""} · <GradeLine grades={directory.grades} />
            {isDemoMode() && <span className="ml-2"><Pill tone="preview">Demonstration data</Pill></span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={secondaryButtonClass} href={`/reports?type=society-status${filters.districtId ? `&districtId=${filters.districtId}` : ""}`}>
            Report
          </Link>
          <Link className={primaryButtonClass} href="/societies/new">
            <Icon className="size-4" name="personAdd" strokeWidth={2} />
            Create society record
          </Link>
        </div>
      </div>

      <nav aria-label="Society lists" className="mt-4 flex flex-wrap gap-1 border-b border-line">
        {VIEWS.map((item) => (
          <Link
            aria-current={item.key === view ? "page" : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold ${
              item.key === view ? "border-brand-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
            href={href({ view: item.key })}
            key={item.key}
          >
            {item.label}
            <span className="rounded-full bg-[#eef0eb] px-1.5 text-[10px] text-muted">{count(directory.views[item.key])}</span>
          </Link>
        ))}
      </nav>

      <form className="mt-3 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-3" method="get" role="search">
        {view !== "all" && <input name="view" type="hidden" value={view} />}
        <label className="sr-only" htmlFor="society-search">Name or S number</label>
        <input className="w-56 rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={filters.q} id="society-search" name="q" placeholder="Name or S number" />
        <label className="sr-only" htmlFor="filter-district">District</label>
        <select className={selectClass} defaultValue={filters.districtId ?? ""} id="filter-district" name="districtId">
          <option value="">District: All</option>
          {districts.map((item) => <option key={item.id} value={item.id}>District: {item.nameEn}</option>)}
        </select>
        <label className="sr-only" htmlFor="filter-ds">DS division</label>
        <input className="w-40 rounded-button border border-line bg-surface px-3 py-2 text-[12px]" defaultValue={filters.dsDivision} id="filter-ds" name="dsDivision" placeholder="DS division: All" />
        <label className="sr-only" htmlFor="filter-grade">Grade</label>
        <select className={selectClass} defaultValue={filters.grade ?? ""} id="filter-grade" name="grade">
          <option value="">Grade: All</option>
          <option value="A">Grade: A</option>
          <option value="B">Grade: B</option>
          <option value="C">Grade: C</option>
          <option value="NONE">Grade: not set</option>
        </select>
        {spcs.length > 0 && (
          <>
            <label className="sr-only" htmlFor="filter-spc">SPC</label>
            <select className={selectClass} defaultValue={filters.spcId ?? ""} id="filter-spc" name="spcId">
              <option value="">SPC: Any</option>
              {spcs.map((spc) => <option key={spc.id} value={spc.id}>SPC: {spc.displayName}</option>)}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="filter-records">Records</label>
        <select className={selectClass} defaultValue={filters.records ?? ""} id="filter-records" name="records">
          <option value="">Records: Any</option>
          <option value="recent">Records: updated in 90 days</option>
          <option value="stale">Records: not updated in 90+ days</option>
        </select>
        <label className="sr-only" htmlFor="filter-request">Grade request</label>
        <select className={selectClass} defaultValue={filters.gradeRequest ?? ""} id="filter-request" name="gradeRequest">
          <option value="">Grade request: Any</option>
          <option value="waiting">Grade request: waiting</option>
          <option value="none">Grade request: none</option>
        </select>
        <button className={secondaryButtonClass} type="submit">Apply</button>
        {active.length > 0 && (
          <Link className="text-[11px] font-semibold text-brand-forest underline" href={view === "all" ? "/societies" : `/societies?view=${view}`}>
            Clear filters
          </Link>
        )}
      </form>

      <div className="mt-3">
        {directory.data.length === 0 ? (
          <section className="rounded-card border border-line bg-surface px-6 py-10 text-center" role="status">
            <Icon className="mx-auto size-8 text-brand-forest" name="search" />
            <h2 className="mt-2 text-[16px] font-bold text-ink">No societies match</h2>
            <p className="mt-1 text-[12px] text-ink-soft">Try a different search, or remove one of the filters.</p>
            {active.length > 0 && (
              <ul aria-label="Active filters" className="mt-3 flex flex-wrap justify-center gap-2">
                {active.map((key) => (
                  <li key={key}>
                    <Link aria-label={`Remove the ${FILTER_LABELS[key]} filter`} className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe0d1] bg-brand-mint-soft px-3 py-1 text-[11px] text-[#2f4a39]" href={href({ [key]: undefined })}>
                      <strong>{FILTER_LABELS[key]}:</strong> {key === "districtId" ? district?.nameEn : key === "spcId" ? spcs.find((spc) => spc.id === filters.spcId)?.displayName : filters[key]}
                      <Icon className="size-3" name="close" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link className={`${primaryButtonClass} mt-4`} href={view === "all" ? "/societies" : `/societies?view=${view}`}>Clear all filters</Link>
          </section>
        ) : (
          <DataTable>
            <caption className="sr-only">Societies</caption>
            <Thead>
              <tr>
                {["S number", "Society", "District", "Grade", "Members", "SPC", "Society Officer · account", "Updated"].map((heading) => (
                  <Th key={heading} scope="col">{heading}</Th>
                ))}
              </tr>
            </Thead>
            <Tbody>
              {directory.data.map((society) => (
                <Tr key={society.id}>
                  <Td className="text-ink-soft">{society.societyCode}</Td>
                  <Td>
                    <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/societies/${society.id}`}>{society.name}</Link>
                    {society.nameLocal && <span className="block text-[10px] text-muted">{society.nameLocal}</span>}
                    {/* A new society's Exco is entered by its Society Officer after HQ creates it. */}
                    {society.excoComplete === false && (
                      <span className="mt-0.5 block">
                        <Pill tone="fast-target">
                          {society.excoSeatsFilled === 0
                            ? "Exco not entered"
                            : society.excoSeatsFilled < 25
                              ? `Exco ${society.excoSeatsFilled} of 25`
                              : society.excoMissingOffices?.length
                                ? `Exco: no ${society.excoMissingOffices.join(", ")}`
                                : "Exco needs checking"}
                        </Pill>
                      </span>
                    )}
                  </Td>
                  <Td className="text-ink-soft">{society.district.name}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <GradeBadge grade={society.grade} />
                      {society.requestedGrade && <Pill tone="fast-target">{society.grade ?? "–"} → {society.requestedGrade} requested</Pill>}
                    </span>
                  </Td>
                  <Td className="text-ink">{society.members === null ? "—" : count(society.members)}</Td>
                  <Td className="text-ink-soft">{society.spc?.name ?? "Not assigned"}</Td>
                  <Td>
                    {society.societyOfficer ? (
                      <span className="flex flex-wrap items-center gap-1.5 text-ink">
                        {society.societyOfficer.name}
                        <Pill tone={society.societyOfficer.status === "ACTIVE" ? "on-time" : "fast-target"}>
                          {society.societyOfficer.status === "ACTIVE" ? "Active" : "Pending"}
                        </Pill>
                      </span>
                    ) : (
                      <span className="text-muted">Not assigned</span>
                    )}
                  </Td>
                  <Td className={society.notUpdatedIn90Days ? "font-semibold text-[#a8312a]" : "text-ink-soft"}>
                    {updatedLabel(society.updatedAt)}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </DataTable>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span>
            Showing {directory.data.length ? (page - 1) * directory.meta.pageSize + 1 : 0}–{(page - 1) * directory.meta.pageSize + directory.data.length} of {count(directory.meta.totalItems)}
            {district ? ` in ${district.nameEn}` : ""}
          </span>
          <Pagination href={(target) => href({ page: target })} page={page} totalPages={directory.meta.totalPages} />
        </div>
      </div>
    </>
  );
}
