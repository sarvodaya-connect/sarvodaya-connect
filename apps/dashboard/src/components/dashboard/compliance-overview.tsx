"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { DistrictSummary } from "@sarvodaya-connect/api-contracts";

import {
  COMPLIANCE_DUE_DATE,
  type ComplianceFilters,
  EMPTY_COMPLIANCE_FILTERS,
  COMPLIANCE_YEAR,
  countFullyCompliant,
  countRequirements,
  isOverdue,
  REGISTRAR_DOCUMENTS,
  REQUIREMENT_STATES,
  requirementState,
  shortSocietyName,
  type RequirementState,
  type RequirementStatus,
  type SocietyCompliance,
} from "@/lib/demo-compliance";

import { type ActiveFilter, EmptyState, NoResultsState, secondaryButtonClass } from "./data-states";
import { Icon, type IconName } from "./icon";

const statusStyle: Record<RequirementStatus, { label: string; icon: IconName; className: string }> = {
  APPROVED: { label: "Approved", icon: "check", className: "bg-[#e5f3e8] text-[#25643f] ring-[#c6e2cd]" },
  UNDER_REVIEW: { label: "Under review", icon: "clock", className: "bg-[#fff5d9] text-[#7a5a00] ring-[#efdda5]" },
  RETURNED: { label: "Returned", icon: "undo", className: "bg-[#ffe9da] text-[#a2470f] ring-[#f3cdb3]" },
  NOT_SUBMITTED: { label: "Missing", icon: "close", className: "bg-[#fbe9e7] text-[#a8312a] ring-[#f1c8c2]" },
};

const stateStyle: Record<RequirementState, { icon: IconName; className: string; activeClassName: string }> = {
  MISSING: { icon: "close", className: "text-[#a8312a]", activeClassName: "border-[#a8312a] bg-[#fdf3f1]" },
  PENDING: { icon: "clock", className: "text-[#7a5a00]", activeClassName: "border-[#b58a12] bg-[#fffaeb]" },
  COMPLETED: { icon: "check", className: "text-[#25643f]", activeClassName: "border-[#2f7c4f] bg-[#f1f8f2]" },
};

const dueLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
  new Date(COMPLIANCE_DUE_DATE),
);

export function RequirementBadge({ status }: { status: RequirementStatus }) {
  const style = statusStyle[status];
  const overdue = isOverdue(status);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style.className}`}
    >
      <Icon className="size-3.5" name={style.icon} />
      {style.label}
      {overdue && <span className="font-bold"> · Overdue</span>}
    </span>
  );
}

function matchesFilters(record: SocietyCompliance, filters: ComplianceFilters, includeState = true) {
  const query = filters.query.trim().toLowerCase();
  if (query && !record.societyName.toLowerCase().includes(query) && !record.societyCode.toLowerCase().includes(query)) {
    return false;
  }
  if (filters.districtId !== "all" && record.districtId !== filters.districtId) return false;
  if (!includeState || filters.state === "all") return true;
  const types = filters.type === "all" ? REGISTRAR_DOCUMENTS.map((document) => document.type) : [filters.type];
  return types.some((type) => requirementState(record.requirements[type].status) === filters.state);
}

export function ComplianceOverview({
  districts,
  initialFilters = EMPTY_COMPLIANCE_FILTERS,
  records,
}: {
  districts: DistrictSummary[];
  initialFilters?: ComplianceFilters;
  records: SocietyCompliance[];
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [reminded, setReminded] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  const update = (changes: Partial<ComplianceFilters>) => setFilters((current) => ({ ...current, ...changes }));

  // Cards and the Registrar strip follow the search, district and type, but not the status they filter by.
  const inScope = useMemo(() => records.filter((record) => matchesFilters(record, filters, false)), [filters, records]);
  const visible = useMemo(() => records.filter((record) => matchesFilters(record, filters)), [filters, records]);
  const counts = countRequirements(inScope, filters.type === "all" ? undefined : filters.type);
  const completedPercent = counts.total === 0 ? 0 : Math.round((counts.COMPLETED / counts.total) * 100);
  const overdueCount = inScope.filter((record) =>
    (filters.type === "all" ? REGISTRAR_DOCUMENTS.map((document) => document.type) : [filters.type]).some((type) =>
      isOverdue(record.requirements[type].status),
    ),
  ).length;
  const typeLabel =
    filters.type === "all" ? "all four documents" : REGISTRAR_DOCUMENTS.find((item) => item.type === filters.type)!.label.toLowerCase();

  const activeFilters: ActiveFilter[] = [];
  if (filters.query.trim()) activeFilters.push({ id: "query", label: "Search", value: `“${filters.query.trim()}”` });
  if (filters.districtId !== "all") {
    activeFilters.push({ id: "districtId", label: "District", value: districts.find((d) => d.id === filters.districtId)?.nameEn ?? filters.districtId });
  }
  if (filters.type !== "all") {
    activeFilters.push({ id: "type", label: "Document", value: REGISTRAR_DOCUMENTS.find((d) => d.type === filters.type)!.label });
  }
  if (filters.state !== "all") {
    activeFilters.push({ id: "state", label: "Status", value: REQUIREMENT_STATES.find((s) => s.value === filters.state)!.label });
  }

  function removeFilter(id: string) {
    update({ [id]: id === "query" ? "" : "all" } as Partial<ComplianceFilters>);
  }

  function clearAllFilters() {
    setFilters(EMPTY_COMPLIANCE_FILTERS);
    searchInput.current?.focus();
  }

  function sendReminder(record: SocietyCompliance) {
    setReminded((current) => [...current, record.societyId]);
    setAnnouncement(`Reminder recorded for ${record.societyName}. In the demonstration nothing is sent.`);
  }

  if (records.length === 0) {
    return (
      <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <EmptyState
          description="When societies in your area start sending their annual Registrar documents, their progress appears here."
          icon="shield"
          title="No societies to monitor yet"
        />
      </section>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <section aria-labelledby="compliance-summary" className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <h2 className="sr-only" id="compliance-summary">Summary for {typeLabel}</h2>
        <div className="flex items-center gap-4 rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
          <div
            aria-hidden="true"
            className="grid size-20 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(#26744b ${completedPercent * 3.6}deg, #e4ebe3 0deg)` }}
          >
            <span className="grid size-14 place-items-center rounded-full bg-white text-base font-bold text-[#174a32]">
              {completedPercent}%
            </span>
          </div>
          <p className="text-xs leading-5 text-[#5f6d64]">
            <strong className="block text-sm text-[#223329]">{completedPercent}% completed</strong>
            {counts.COMPLETED} of {counts.total} required documents approved ({typeLabel})
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Filter by requirement status">
          {REQUIREMENT_STATES.map((state) => {
            const active = filters.state === state.value;
            return (
              <button
                aria-pressed={active}
                className={`rounded-xl border bg-white p-4 text-left shadow-[0_8px_26px_rgba(24,56,35,0.04)] transition hover:border-[#9fbfa8] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd] ${
                  active ? stateStyle[state.value].activeClassName : "border-[#dfe5dc]"
                }`}
                key={state.value}
                onClick={() => update({ state: active ? "all" : state.value })}
                type="button"
              >
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${stateStyle[state.value].className}`}>
                  <Icon className="size-4" name={stateStyle[state.value].icon} />
                  {state.label}
                </span>
                <strong className="mt-2 block text-2xl font-semibold text-[#1d2b22]">{counts[state.value]}</strong>
                <span className="mt-1 block text-[11px] text-[#738078]">
                  {state.value === "MISSING" && overdueCount > 0
                    ? `${overdueCount} ${overdueCount === 1 ? "society is" : "societies are"} overdue`
                    : state.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="registrar-strip"
        className="rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-[0_8px_26px_rgba(24,56,35,0.04)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#223329]" id="registrar-strip">
            Annual documents to the Registrar · {COMPLIANCE_YEAR}
          </h2>
          <p className="text-xs text-[#68756c]">
            Due {dueLabel} · <strong className="text-[#223329]">{countFullyCompliant(inScope)} of {inScope.length}</strong>{" "}
            societies have all four approved
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REGISTRAR_DOCUMENTS.map((document, index) => {
            const documentCounts = countRequirements(inScope, document.type);
            const active = filters.type === document.type;
            return (
              <button
                aria-pressed={active}
                className={`rounded-lg border p-3 text-left transition hover:border-[#9fbfa8] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd] ${
                  active ? "border-[#2f7c4f] bg-[#f1f8f2]" : "border-[#e4e8e2] bg-[#fbfcfa]"
                }`}
                key={document.type}
                onClick={() => update({ type: active ? "all" : document.type })}
                type="button"
              >
                <span className="block text-xs font-semibold text-[#2c3c32]">
                  {index + 1} · {document.label}
                </span>
                <span className="mt-1 block text-lg font-semibold text-[#174a32]">
                  {documentCounts.COMPLETED}
                  <span className="text-xs font-normal text-[#738078]"> / {documentCounts.total} approved</span>
                </span>
                <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#e4e9e2]">
                  <span
                    className="block h-full rounded-full bg-[#2f7c4f]"
                    style={{ width: `${documentCounts.total ? (documentCounts.COMPLETED / documentCounts.total) * 100 : 0}%` }}
                  />
                </span>
                <span className="mt-2 block text-[11px] text-[#738078]">
                  {documentCounts.PENDING} pending · {documentCounts.MISSING} missing · {document.note}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <div className="grid gap-3 border-b border-[#e4e8e2] p-4 md:grid-cols-[minmax(220px,1fr)_170px_190px_170px]">
          <label className="relative block">
            <span className="sr-only">Search societies</span>
            <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78857d]" name="search" />
            <input
              className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
              onChange={(event) => update({ query: event.target.value })}
              placeholder="Search by society name or ID"
              ref={searchInput}
              type="search"
              value={filters.query}
            />
          </label>
          <label>
            <span className="sr-only">Filter by district</span>
            <select
              className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
              onChange={(event) => update({ districtId: event.target.value })}
              value={filters.districtId}
            >
              <option value="all">All districts</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>{district.nameEn}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by document type</span>
            <select
              className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
              onChange={(event) => update({ type: event.target.value as ComplianceFilters["type"] })}
              value={filters.type}
            >
              <option value="all">All four documents</option>
              {REGISTRAR_DOCUMENTS.map((document) => (
                <option key={document.type} value={document.type}>{document.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
              onChange={(event) => update({ state: event.target.value as ComplianceFilters["state"] })}
              value={filters.state}
            >
              <option value="all">All statuses</option>
              {REQUIREMENT_STATES.map((state) => (
                <option key={state.value} value={state.value}>{state.label}</option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <NoResultsState
            filters={activeFilters}
            itemLabel="societies"
            onClearAll={clearAllFilters}
            onRemoveFilter={removeFilter}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <caption className="sr-only">Registrar documents for each society, {COMPLIANCE_YEAR}</caption>
              <thead className="bg-[#f7f8f5] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#738078]">
                <tr>
                  <th className="px-4 py-3" scope="col">Society</th>
                  {REGISTRAR_DOCUMENTS.map((document) => (
                    <th
                      className={`px-3 py-3 ${filters.type === document.type ? "text-[#174a32]" : ""}`}
                      key={document.type}
                      scope="col"
                    >
                      {document.label}
                    </th>
                  ))}
                  <th className="px-3 py-3" scope="col">Approved</th>
                  <th className="px-4 py-3" scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0eb]">
                {visible.map((record) => {
                  const statuses = REGISTRAR_DOCUMENTS.map((document) => record.requirements[document.type].status);
                  const completed = statuses.filter((status) => status === "APPROVED").length;
                  const hasMissing = statuses.includes("NOT_SUBMITTED");
                  const wasReminded = reminded.includes(record.societyId);
                  return (
                    <tr className="transition hover:bg-[#f8faf6]" key={record.societyId}>
                      <th className="px-4 py-4 text-left font-normal" scope="row">
                        <Link
                          aria-label={record.societyName}
                          className="block whitespace-nowrap text-sm font-semibold text-[#223329] hover:text-[#26744b] hover:underline"
                          href={`/societies/${record.societyId}`}
                        >
                          {shortSocietyName(record.societyName)}
                        </Link>
                        <span className="mt-1 block whitespace-nowrap text-xs text-[#748078]">
                          {record.societyCode} · {record.districtName}
                        </span>
                      </th>
                      {REGISTRAR_DOCUMENTS.map((document) => (
                        <td className="px-3 py-4" key={document.type}>
                          <RequirementBadge status={record.requirements[document.type].status} />
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-4 text-xs font-medium text-[#526057]">{completed} of 4</td>
                      <td className="px-4 py-4 text-right">
                        {hasMissing ? (
                          <button
                            aria-label={wasReminded ? `Reminder sent to ${record.societyName}` : `Send reminder to ${record.societyName}`}
                            className={`inline-flex whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0] ${
                              wasReminded
                                ? "cursor-default border border-[#ccd6ce] bg-white text-[#5f6d64]"
                                : "bg-[#1f6b43] text-white hover:bg-[#174f34]"
                            }`}
                            disabled={wasReminded}
                            onClick={() => sendReminder(record)}
                            type="button"
                          >
                            {wasReminded ? "Reminder sent" : "Send reminder"}
                          </button>
                        ) : (
                          <Link
                            aria-label={`View documents from ${record.societyName}`}
                            className={`${secondaryButtonClass} whitespace-nowrap px-3 py-2 text-xs`}
                            href={`/documents?society=${record.societyId}`}
                          >
                            View documents
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8ece6] px-5 py-3 text-xs text-[#738078]">
          <p aria-live="polite" role="status">
            Showing {visible.length} of {records.length} societies
          </p>
          <p aria-live="polite">{announcement}</p>
        </div>
      </section>
    </div>
  );
}
