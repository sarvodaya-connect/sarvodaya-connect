"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { DistrictSummary, SocietyDetails } from "@sarvodaya-connect/api-contracts";

import { type ActiveFilter, EmptyState, NoResultsState } from "./data-states";
import { Icon } from "./icon";
import { Pill } from "./ui/pill";

const statusOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
] as const;

const auditOptions = [
  { value: "VERIFIED", label: "Verified" },
  { value: "PENDING", label: "Pending" },
  { value: "UNVERIFIED", label: "Unverified" },
] as const;

type ViewTab = "all" | "follow-up" | "stale";

const STALE_DAYS = 90;

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function isStale(society: SocietyDetails) {
  const updated = new Date(society.updatedAt).getTime();
  return Number.isFinite(updated) && Date.now() - updated > STALE_DAYS * 24 * 60 * 60 * 1000;
}

function needsFollowUp(society: SocietyDetails) {
  return society.status === "UNDER_REVIEW" || society.status === "SUSPENDED" || society.verificationStatus === "UNVERIFIED";
}

const statusTone = {
  ACTIVE: "on-time",
  UNDER_REVIEW: "under-review",
  INACTIVE: "inactive",
  SUSPENDED: "overdue",
} as const;

export function SocietyDirectory({
  districts,
  societies,
}: {
  districts: DistrictSummary[];
  societies: SocietyDetails[];
}) {
  const [districtId, setDistrictId] = useState("all");
  const [division, setDivision] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [audit, setAudit] = useState("all");
  const [tab, setTab] = useState<ViewTab>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return societies.filter((society) => {
      const matchesQuery =
        !normalizedQuery ||
        society.nameEn.toLowerCase().includes(normalizedQuery) ||
        society.societyCode.toLowerCase().includes(normalizedQuery) ||
        (society.nameLocal?.toLowerCase().includes(normalizedQuery) ?? false);
      const matchesDistrict = districtId === "all" || society.district.id === districtId;
      const matchesDivision = division === "all" || society.address.dsDivision === division;
      const matchesStatus = status === "all" || society.status === status;
      const matchesAudit = audit === "all" || society.verificationStatus === audit;
      const matchesTab =
        tab === "all" ||
        (tab === "follow-up" && needsFollowUp(society)) ||
        (tab === "stale" && isStale(society));
      return matchesQuery && matchesDistrict && matchesDivision && matchesStatus && matchesAudit && matchesTab;
    });
  }, [audit, districtId, division, query, societies, status, tab]);

  const divisions = Array.from(
    new Set(societies.map((society) => society.address.dsDivision).filter((value): value is string => Boolean(value))),
  ).sort();

  const followUpCount = useMemo(() => societies.filter(needsFollowUp).length, [societies]);
  const staleCount = useMemo(() => societies.filter(isStale).length, [societies]);

  const activeFilters: ActiveFilter[] = [];
  if (query.trim()) activeFilters.push({ id: "query", label: "Search", value: `“${query.trim()}”` });
  if (districtId !== "all") {
    const district = districts.find((item) => item.id === districtId);
    activeFilters.push({ id: "district", label: "District", value: district?.nameEn ?? districtId });
  }
  if (division !== "all") activeFilters.push({ id: "division", label: "Division", value: division });
  if (status !== "all") {
    const option = statusOptions.find((item) => item.value === status);
    activeFilters.push({ id: "status", label: "Status", value: option?.label ?? status });
  }
  if (audit !== "all") {
    const option = auditOptions.find((item) => item.value === audit);
    activeFilters.push({ id: "audit", label: "Audit", value: option?.label ?? audit });
  }

  function removeFilter(id: string) {
    if (id === "query") setQuery("");
    if (id === "district") setDistrictId("all");
    if (id === "division") setDivision("all");
    if (id === "status") setStatus("all");
    if (id === "audit") setAudit("all");
  }

  function clearAllFilters() {
    setQuery("");
    setDistrictId("all");
    setDivision("all");
    setStatus("all");
    setAudit("all");
    searchInput.current?.focus();
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((society) => selected.has(society.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filtered.forEach((society) => next.delete(society.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((society) => next.add(society.id));
      return next;
    });
  }

  if (societies.length === 0) {
    return (
      <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        <EmptyState
          description="Societies appear here once they are added to the registry and approved by their District Centre."
          icon="society"
          title="No societies in the registry yet"
        />
      </section>
    );
  }

  const tabs: { id: ViewTab; label: string; count?: number }[] = [
    { id: "all", label: "All societies", count: societies.length },
    { id: "follow-up", label: "Needs follow-up", count: followUpCount },
    { id: "stale", label: `Stale data (${STALE_DAYS}+ days)`, count: staleCount },
  ];

  return (
    <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <nav aria-label="View" className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              aria-pressed={tab === item.id}
              className={`inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === item.id
                  ? "bg-brand-forest text-white"
                  : "border border-line bg-surface text-ink-soft hover:border-brand-leaf hover:text-brand-leaf"
              }`}
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
              {typeof item.count === "number" && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-bold ${
                    tab === item.id ? "bg-white/15 text-white" : "bg-brand-mint text-brand-forest"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
          <button className="text-[12px] font-semibold text-brand-leaf hover:underline" type="button">
            + Save current view
          </button>
        </nav>
        <button
          className="inline-flex items-center gap-2 rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
          type="button"
        >
          <Icon className="size-4" name="document" />
          Export CSV / Excel
        </button>
      </div>

      <div className="grid gap-3 border-b border-line-soft p-4 md:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(0,1fr))]">
        <label className="relative block">
          <span className="sr-only">Search societies</span>
          <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" name="search" />
          <input
            className="w-full rounded-input border border-line bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, Society ID or local name"
            ref={searchInput}
            type="search"
            value={query}
          />
        </label>
        <label>
          <span className="sr-only">Filter by district</span>
          <select
            className="w-full rounded-input border border-line bg-surface px-3 py-2.5 text-sm text-ink-soft outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]"
            onChange={(event) => setDistrictId(event.target.value)}
            value={districtId}
          >
            <option value="all">District: All</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>{district.nameEn}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by division</span>
          <select
            className="w-full rounded-input border border-line bg-surface px-3 py-2.5 text-sm text-ink-soft outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]"
            onChange={(event) => setDivision(event.target.value)}
            value={division}
          >
            <option value="all">DS/GN: All</option>
            {divisions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            className="w-full rounded-input border border-line bg-surface px-3 py-2.5 text-sm text-ink-soft outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">Status: All</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by audit</span>
          <select
            className="w-full rounded-input border border-line bg-surface px-3 py-2.5 text-sm text-ink-soft outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]"
            onChange={(event) => setAudit(event.target.value)}
            value={audit}
          >
            <option value="all">Audit: All</option>
            {auditOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-brand-mint-soft px-5 py-3 text-[12px]">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="text-ink">{selected.size} selected</strong>
            <button className="rounded-button border border-line bg-surface px-3 py-1.5 font-semibold text-ink-soft hover:border-brand-leaf hover:text-brand-leaf" type="button">
              Send request
            </button>
            <button className="rounded-button border border-line bg-surface px-3 py-1.5 font-semibold text-ink-soft hover:border-brand-leaf hover:text-brand-leaf" type="button">
              Export selected
            </button>
          </div>
          <button className="font-semibold text-brand-leaf hover:underline" onClick={() => setSelected(new Set())} type="button">
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <NoResultsState
          filters={activeFilters}
          itemLabel="societies"
          onClearAll={clearAllFilters}
          onRemoveFilter={removeFilter}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <caption className="sr-only">Village societies</caption>
            <thead className="bg-surface-muted text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-5 py-3" scope="col">
                  <label className="inline-flex items-center">
                    <span className="sr-only">Select all</span>
                    <input
                      aria-label="Select all societies on this page"
                      checked={allVisibleSelected}
                      className="size-4 rounded border-line text-brand-action focus:ring-brand-leaf"
                      onChange={toggleSelectAll}
                      type="checkbox"
                    />
                  </label>
                </th>
                <th className="px-4 py-3" scope="col">Society ID</th>
                <th className="px-4 py-3" scope="col">Name</th>
                <th className="px-4 py-3" scope="col">Local name</th>
                <th className="px-4 py-3" scope="col">District</th>
                <th className="px-4 py-3" scope="col">DS / GN</th>
                <th className="px-4 py-3" scope="col">Status</th>
                <th className="px-4 py-3 text-right" scope="col"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.map((society) => {
                const tone = statusTone[society.status as keyof typeof statusTone] ?? "inactive";
                const statusLabel = statusOptions.find((item) => item.value === society.status)?.label ?? society.status;
                return (
                  <tr className="transition hover:bg-brand-mint-soft" key={society.id}>
                    <td className="px-5 py-3">
                      <label className="inline-flex items-center">
                        <span className="sr-only">Select {society.nameEn}</span>
                        <input
                          aria-label={`Select ${society.nameEn}`}
                          checked={selected.has(society.id)}
                          className="size-4 rounded border-line text-brand-action focus:ring-brand-leaf"
                          onChange={() => toggleSelected(society.id)}
                          type="checkbox"
                        />
                      </label>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] font-mono text-ink-soft">{society.societyCode}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="text-[13px] font-semibold text-ink hover:text-brand-leaf"
                        href={`/societies/${society.id}`}
                      >
                        {society.nameEn}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Updated {dateFormatter.format(new Date(society.updatedAt))} · {society.profileCompleteness}% complete
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink-soft">{society.nameLocal ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] text-ink-soft">{society.district.nameEn}</td>
                    <td className="px-4 py-3 text-[12px] text-muted">
                      {society.address.dsDivision ?? "—"}
                      {society.address.gnDivision && (
                        <span className="block text-[11px] text-muted">{society.address.gnDivision}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={tone}>{statusLabel}</Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        aria-label={`Open ${society.nameEn}`}
                        className="inline-flex items-center gap-1 rounded-button px-2 py-1 text-[12px] font-semibold text-brand-leaf hover:bg-brand-mint-soft"
                        href={`/societies/${society.id}`}
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-line-soft px-5 py-3 text-[12px] text-muted">
        <p aria-live="polite" role="status">
          Showing {filtered.length} of {societies.length} demonstration records
        </p>
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button className="rounded-button px-2 py-1 text-ink-soft hover:bg-brand-mint-soft" type="button">←</button>
          <span className="rounded-button bg-brand-mint px-2.5 py-1 font-semibold text-brand-forest">1</span>
          <button className="rounded-button px-2 py-1 text-ink-soft hover:bg-brand-mint-soft" type="button">→</button>
        </nav>
      </div>
    </section>
  );
}
