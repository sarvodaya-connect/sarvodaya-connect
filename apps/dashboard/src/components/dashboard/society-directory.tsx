"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DistrictSummary, PaginatedResponse, SocietySummary } from "@sarvodaya-connect/api-contracts";
import { EmptyState, ErrorState, NoResultsState, TableSkeleton } from "./data-states";
import { Icon } from "./icon";
import { Pill } from "./ui/pill";

type Props = { districts: DistrictSummary[]; societies: SocietySummary[]; initialTotal: number };
type Filters = { search: string; districtId: string; division: string; grade: string; spcUserId: string; freshness: string; gradeRequest: string };
const initialFilters: Filters = { search: "", districtId: "all", division: "all", grade: "all", spcUserId: "all", freshness: "all", gradeRequest: "all" };
const PAGE_SIZE = 10;
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function SocietyDirectory({ districts, societies: initialSocieties, initialTotal }: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [societies, setSocieties] = useState(initialSocieties);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (filters.search.trim()) query.set("search", filters.search.trim());
    if (filters.districtId !== "all") query.set("districtId", filters.districtId);
    if (filters.division !== "all") query.set("dsDivision", filters.division);
    if (filters.grade !== "all") query.set("grade", filters.grade);
    if (filters.spcUserId !== "all") query.set("spcUserId", filters.spcUserId);
    if (filters.freshness !== "all") query.set("freshness", filters.freshness.toUpperCase());
    if (filters.gradeRequest !== "all") query.set("gradeRequest", filters.gradeRequest.toUpperCase());
    return query.toString();
  }, [filters, page]);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true); setError(false);
      try {
        const response = await fetch(`/api/societies?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Society directory unavailable");
        const result = await response.json() as PaginatedResponse<SocietySummary>;
        if (!cancelled) { setSocieties(result.data); setTotal(result.meta.totalItems); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, filters.search ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [filters.search, params, retryKey]);

  const divisions = [...new Set(initialSocieties.map((society) => society.dsDivision).filter((value): value is string => Boolean(value)))].sort();
  const spcs = [...new Map(initialSocieties.filter((society) => society.spcUserId && society.spcName).map((society) => [society.spcUserId!, society.spcName!])).entries()];
  const filterClass = "rounded-button border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink-soft outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]";
  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }
  function clearAll() { setFilters(initialFilters); setPage(1); }

  if (initialTotal === 0 && !loading) return <section className="mt-6 rounded-card border border-line bg-surface"><EmptyState title="No societies in your permitted scope" description="The registry doesn&apos;t have society records available to your role yet." icon="society" /></section>;

  return <section className="mt-4">
    <div className="rounded-card border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block min-w-[220px] flex-1"><span className="sr-only">Search societies</span><Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" name="search" /><input className="w-full rounded-button border border-line bg-surface py-1.5 pl-9 pr-3 text-[12px] outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]" onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search name or S number" type="search" value={filters.search} /></label>
        <label><span className="sr-only">Filter by district</span><select className={filterClass} onChange={(event) => updateFilter("districtId", event.target.value)} value={filters.districtId}><option value="all">District: All</option>{districts.map((district) => <option key={district.id} value={district.id}>{district.nameEn}</option>)}</select></label>
        <label><span className="sr-only">Filter by DS division</span><select className={filterClass} onChange={(event) => updateFilter("division", event.target.value)} value={filters.division}><option value="all">DS division: All</option>{divisions.map((division) => <option key={division} value={division}>{division}</option>)}</select></label>
        <label><span className="sr-only">Filter by grade</span><select className={filterClass} onChange={(event) => updateFilter("grade", event.target.value)} value={filters.grade}><option value="all">Grade: All</option>{["A", "B", "C"].map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
        <label><span className="sr-only">Filter by assigned SPC</span><select className={filterClass} onChange={(event) => updateFilter("spcUserId", event.target.value)} value={filters.spcUserId}><option value="all">SPC: Any</option>{spcs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label><span className="sr-only">Filter by record freshness</span><select className={filterClass} onChange={(event) => updateFilter("freshness", event.target.value)} value={filters.freshness}><option value="all">Records: Any</option><option value="recent">Updated recently</option><option value="stale">90+ days</option></select></label>
        <label><span className="sr-only">Filter by open grade request</span><select className={filterClass} onChange={(event) => updateFilter("gradeRequest", event.target.value)} value={filters.gradeRequest}><option value="all">Grade request: Any</option><option value="open">Open requests</option><option value="none">No open request</option></select></label>
        {Object.entries(filters).some(([key, value]) => key !== "search" || value.trim()) && <button className="px-2 py-1 text-xs font-semibold text-[#2d5c88] underline" onClick={clearAll} type="button">Clear filters</button>}
      </div>
    </div>
    <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
      {error ? <ErrorState onRetry={() => setRetryKey((value) => value + 1)} title="Society results couldn&apos;t be loaded" /> : loading ? <TableSkeleton columns={8} label="Loading societies" rows={5} /> : societies.length === 0 ? <NoResultsState filters={[]} itemLabel="societies" onClearAll={clearAll} onRemoveFilter={() => undefined} /> : <div className="overflow-x-auto"><table className="w-full min-w-[930px] border-collapse text-left"><caption className="sr-only">Societies in your permitted scope</caption><thead className="bg-surface-muted text-[11px] font-medium text-ink-soft"><tr>{["S number", "Society", "District", "Grade", "Members", "SPC", "Society Officer · account", "Updated"].map((label) => <th className="px-3 py-3" key={label} scope="col">{label}</th>)}</tr></thead><tbody className="divide-y divide-line-soft">{societies.map((society) => <tr className="hover:bg-brand-mint-soft" key={society.id}><td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-ink-soft">{society.societyCode}</td><td className="px-3 py-2.5"><Link className="text-[12px] text-[#2d5c88] underline underline-offset-2" href={`/societies/${society.id}`}>{society.nameEn.replace("Sarvodaya Shramadana Society", "SSS")}</Link>{society.hasOpenGradeRequest && <span className="ml-2 rounded-full bg-[#fff5d9] px-2 py-0.5 text-[10px] font-semibold text-[#7a5a00]">Grade request</span>}</td><td className="px-3 py-2.5 text-[12px] text-ink-soft">{society.district.nameEn}</td><td className="px-3 py-2.5"><Pill dot={false} tone="inactive">{society.grade ?? "—"}</Pill></td><td className="px-3 py-2.5 text-right text-[12px] text-ink-soft">{society.memberCount?.toLocaleString("en-GB") ?? "—"}</td><td className="px-3 py-2.5 text-[12px] text-ink-soft">{society.spcName ?? "Not assigned"}</td><td className="px-3 py-2.5 text-[12px] text-ink-soft">{society.societyOfficerName ?? "Not assigned"}<span className="ml-2 text-muted">— account data unavailable</span></td><td className="px-3 py-2.5 text-[12px] text-ink-soft">{dateFormatter.format(new Date(society.updatedAt))}</td></tr>)}</tbody></table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-[11px] text-muted"><p aria-live="polite" role="status">Showing {societies.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + societies.length} of {total} societies</p><nav aria-label="Pagination" className="flex items-center gap-1"><button aria-label="Previous page" className="rounded-button border border-line px-2 py-1 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">←</button><span className="px-2">{page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span><button aria-label="Next page" className="rounded-button border border-line px-2 py-1 disabled:opacity-40" disabled={page >= Math.ceil(total / PAGE_SIZE) || loading} onClick={() => setPage((current) => current + 1)} type="button">→</button></nav></div>
    </div>
  </section>;
}
