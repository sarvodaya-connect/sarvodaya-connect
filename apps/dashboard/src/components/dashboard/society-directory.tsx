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
  const [compact, setCompact] = useState(false);
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

  const filterClass =
    "rounded-button border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink-soft outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]";
  const cell = compact ? "py-1.5" : "py-2.5";

  return (
    <section className="mt-4">
      <nav aria-label="View" className="flex flex-wrap items-end gap-5 border-b border-line">
        {tabs.map((item) => (
          <button
            aria-pressed={tab === item.id}
            className={`-mb-px border-b-2 pb-2 text-[12px] transition ${
              tab === item.id
                ? "border-brand-forest font-semibold text-ink"
                : "border-transparent text-ink-soft hover:text-brand-forest"
            }`}
            key={item.id}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
            {typeof item.count === "number" && item.id !== "all" && <span> · {item.count}</span>}
          </button>
        ))}
        <button className="pb-2 text-[12px] font-semibold text-[#2d5c88] hover:underline" type="button">
          + Save current view
        </button>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="relative block">
          <span className="sr-only">Search societies</span>
          <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" name="search" />
          <input
            className="w-56 rounded-button border border-line bg-surface py-1.5 pl-9 pr-3 text-[12px] outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]"
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
            className={filterClass}
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
            className={filterClass}
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
            className={filterClass}
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
            className={filterClass}
            onChange={(event) => setAudit(event.target.value)}
            value={audit}
          >
            <option value="all">Audit: All</option>
            {auditOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <div aria-label="Row density" className="ml-auto inline-flex overflow-hidden rounded-button border border-line bg-surface text-[11px]" role="group">
          {[false, true].map((value) => (
            <button
              aria-pressed={compact === value}
              className={`px-2.5 py-1.5 ${compact === value ? "bg-brand-forest font-semibold text-white" : "text-ink-soft"}`}
              key={String(value)}
              onClick={() => setCompact(value)}
              type="button"
            >
              {value ? "Compact" : "Comfortable"}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-button bg-brand-forest px-4 py-2 text-[12px] text-white">
          <div className="flex flex-wrap items-center gap-4">
            <strong>{selected.size} selected</strong>
            <button className="underline underline-offset-2" type="button">
              Send request
            </button>
            <button className="underline underline-offset-2" type="button">
              Export selected
            </button>
          </div>
          <button className="underline underline-offset-2" onClick={() => setSelected(new Set())} type="button">
            Clear
          </button>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
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
            <thead className="bg-surface-muted text-[12px] font-medium text-ink-soft">
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
                <th className="px-4 py-3" scope="col">Name ↑</th>
                <th className="px-4 py-3" scope="col">Local name</th>
                <th className="px-4 py-3" scope="col">District</th>
                <th className="px-4 py-3" scope="col">DS / GN</th>
                <th className="px-4 py-3" scope="col">Status</th>
                <th className="px-4 py-3 text-right" scope="col">Complete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {filtered.map((society) => {
                const tone = statusTone[society.status as keyof typeof statusTone] ?? "inactive";
                const statusLabel = statusOptions.find((item) => item.value === society.status)?.label ?? society.status;
                return (
                  <tr className={`transition hover:bg-brand-mint-soft ${selected.has(society.id) ? "bg-brand-mint-soft" : ""}`} key={society.id}>
                    <td className={`px-5 ${cell}`}>
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
                    <td className={`whitespace-nowrap px-4 ${cell} text-[12px] text-ink-soft`}>{society.societyCode}</td>
                    <td className={`px-4 ${cell}`}>
                      <Link
                        aria-label={`Open ${society.nameEn}`}
                        className="text-[12.5px] text-[#2d5c88] underline underline-offset-2 hover:text-brand-forest"
                        href={`/societies/${society.id}`}
                        title={`Updated ${dateFormatter.format(new Date(society.updatedAt))}`}
                      >
                        {society.nameEn}
                      </Link>
                    </td>
                    <td className={`px-4 ${cell} text-[12.5px] text-ink-soft`}>{society.nameLocal ?? "—"}</td>
                    <td className={`px-4 ${cell} text-[12.5px] text-ink-soft`}>{society.district.nameEn}</td>
                    <td className={`px-4 ${cell} text-[12px] text-ink-soft`}>
                      {[society.address.dsDivision, society.address.gnDivision].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className={`px-4 ${cell}`}>
                      <Pill tone={tone}>{statusLabel}</Pill>
                    </td>
                    <td className={`px-4 ${cell} text-right text-[12px] font-semibold text-ink-soft`}>
                      {society.profileCompleteness}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-line-soft px-5 py-3 text-[11px] text-muted">
        <p aria-live="polite" role="status">
          Showing {filtered.length} of {societies.length} demonstration records
        </p>
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button className="rounded-button px-2 py-1 text-ink-soft hover:bg-brand-mint-soft" type="button">←</button>
          <span className="rounded-button bg-brand-mint px-2.5 py-1 font-semibold text-brand-forest">1</span>
          <button className="rounded-button px-2 py-1 text-ink-soft hover:bg-brand-mint-soft" type="button">→</button>
        </nav>
      </div>
      </div>
    </section>
  );
}
