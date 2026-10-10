"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { DistrictSummary, SocietySummary } from "@sarvodaya-connect/api-contracts";

import { type ActiveFilter, EmptyState, NoResultsState } from "./data-states";
import { Icon } from "./icon";
import { StatusPill } from "./status-pill";

const statusOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "INACTIVE", label: "Inactive" },
] as const;

export function SocietyDirectory({
  districts,
  societies,
}: {
  districts: DistrictSummary[];
  societies: SocietySummary[];
}) {
  const [districtId, setDistrictId] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const searchInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return societies.filter((society) => {
      const matchesQuery =
        !normalizedQuery ||
        society.nameEn.toLowerCase().includes(normalizedQuery) ||
        society.societyCode.toLowerCase().includes(normalizedQuery);
      const matchesDistrict = districtId === "all" || society.district.id === districtId;
      const matchesStatus = status === "all" || society.status === status;
      return matchesQuery && matchesDistrict && matchesStatus;
    });
  }, [districtId, query, societies, status]);

  const activeFilters: ActiveFilter[] = [];
  if (query.trim()) activeFilters.push({ id: "query", label: "Search", value: `“${query.trim()}”` });
  if (districtId !== "all") {
    const district = districts.find((item) => item.id === districtId);
    activeFilters.push({ id: "district", label: "District", value: district?.nameEn ?? districtId });
  }
  if (status !== "all") {
    const option = statusOptions.find((item) => item.value === status);
    activeFilters.push({ id: "status", label: "Status", value: option?.label ?? status });
  }

  function removeFilter(id: string) {
    if (id === "query") setQuery("");
    if (id === "district") setDistrictId("all");
    if (id === "status") setStatus("all");
  }

  function clearAllFilters() {
    setQuery("");
    setDistrictId("all");
    setStatus("all");
    searchInput.current?.focus();
  }

  if (societies.length === 0) {
    return (
      <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <EmptyState
          description="Societies appear here once they are added to the registry and approved by their District Centre."
          icon="society"
          title="No societies in the registry yet"
        />
      </section>
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <div className="grid gap-3 border-b border-[#e4e8e2] p-4 md:grid-cols-[minmax(240px,1fr)_180px_170px]">
        <label className="relative block">
          <span className="sr-only">Search societies</span>
          <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78857d]" name="search" />
          <input
            className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by society name or ID"
            ref={searchInput}
            type="search"
            value={query}
          />
        </label>
        <label>
          <span className="sr-only">Filter by district</span>
          <select
            className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
            onChange={(event) => setDistrictId(event.target.value)}
            value={districtId}
          >
            <option value="all">All districts</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>{district.nameEn}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by status</span>
          <select
            className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <NoResultsState
          filters={activeFilters}
          itemLabel="societies"
          onClearAll={clearAllFilters}
          onRemoveFilter={removeFilter}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <caption className="sr-only">Village societies</caption>
            <thead className="bg-[#f7f8f5] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#738078]">
              <tr>
                <th className="px-5 py-3" scope="col">Society</th>
                <th className="px-5 py-3" scope="col">District</th>
                <th className="px-5 py-3" scope="col">Completeness</th>
                <th className="px-5 py-3" scope="col">Status</th>
                <th className="px-5 py-3" scope="col">Last updated</th>
                <th className="px-5 py-3" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0eb]">
              {filtered.map((society) => (
                <tr className="transition hover:bg-[#f8faf6]" key={society.id}>
                  <td className="px-5 py-4">
                    <strong className="block max-w-sm text-sm font-semibold text-[#223329]">{society.nameEn}</strong>
                    <span className="mt-1 block text-xs text-[#748078]">{society.societyCode}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-[#4d5b52]">
                    <Link className="rounded-sm hover:text-[#26744b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26744b]" href={`/districts/${society.district.nameEn.toLowerCase()}`}>
                      {society.district.nameEn}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e4e9e2]">
                        <div className="h-full rounded-full bg-[#2f7c4f]" style={{ width: `${society.profileCompleteness}%` }} />
                      </div>
                      <span className="text-xs font-medium text-[#526057]">{society.profileCompleteness}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4"><StatusPill value={society.status} /></td>
                  <td className="px-5 py-4 text-xs text-[#617067]">
                    {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(society.updatedAt))}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      aria-label={`Open ${society.nameEn}`}
                      className="inline-flex rounded-md bg-[#1f6b43] px-3 py-2 text-xs font-semibold text-white hover:bg-[#174f34] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]"
                      href={`/societies/${society.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-[#e8ece6] px-5 py-3 text-xs text-[#738078]">
        <p aria-live="polite" role="status">
          Showing {filtered.length} of {societies.length} demonstration records
        </p>
        <span>Page 1 of 1</span>
      </div>
    </section>
  );
}
