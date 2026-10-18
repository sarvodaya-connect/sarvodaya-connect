"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { DistrictSummary, DocumentStatus } from "@sarvodaya-connect/api-contracts";

import {
  COMPLIANCE_YEAR,
  countFullyCompliant,
  REGISTRAR_DOCUMENTS,
  type SocietyCompliance,
} from "@/lib/demo-compliance";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPES,
  type DocumentFilters,
  EMPTY_DOCUMENT_FILTERS,
  type LibraryDocument,
  searchDocuments,
} from "@/lib/demo-documents";

import { type ActiveFilter, EmptyState, NoResultsState, primaryButtonClass, secondaryButtonClass } from "./data-states";
import { Icon } from "./icon";

const statusClass: Record<DocumentStatus, string> = {
  DRAFT: "bg-[#f0f1ee] text-[#667168] ring-[#dde1dc]",
  SUBMITTED: "bg-[#fff5d9] text-[#7a5a00] ring-[#efdda5]",
  APPROVED: "bg-[#e5f3e8] text-[#25643f] ring-[#c6e2cd]",
  REJECTED: "bg-[#ffe9da] text-[#a2470f] ring-[#f3cdb3]",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusClass[status]}`}>
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}

function typeLabel(type: string) {
  return DOCUMENT_TYPES.find((item) => item.value === type)?.label ?? type;
}

export type SocietyOption = { id: string; name: string };

export function DocumentLibrary({
  districts,
  documents,
  initialFilters = EMPTY_DOCUMENT_FILTERS,
  registrarRecords,
  roleNotice,
  societies,
}: {
  districts: DistrictSummary[];
  /** Only the documents the viewer may see; restricted files are removed on the server. */
  documents: LibraryDocument[];
  initialFilters?: DocumentFilters;
  /** Compliance records for the Registrar strip. Omitted for roles that cannot see Registrar documents. */
  registrarRecords?: SocietyCompliance[];
  /** Explains which documents this role does not see. */
  roleNotice?: string;
  societies: SocietyOption[];
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const update = (changes: Partial<DocumentFilters>) => setFilters((current) => ({ ...current, ...changes }));
  const matches = useMemo(() => searchDocuments(documents, filters), [documents, filters]);
  // Category counts follow every filter except the category itself.
  const countsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const match of searchDocuments(documents, { ...filters, type: "all" })) {
      counts.set(match.document.type, (counts.get(match.document.type) ?? 0) + 1);
    }
    return counts;
  }, [documents, filters]);
  const typesInView = DOCUMENT_TYPES.filter((type) => documents.some((document) => document.type === type.value));
  const selected = matches.find((match) => match.document.id === selectedId) ?? null;

  const activeFilters: ActiveFilter[] = [];
  if (filters.query.trim()) activeFilters.push({ id: "query", label: "Search", value: `“${filters.query.trim()}”` });
  if (filters.districtId !== "all") {
    activeFilters.push({ id: "districtId", label: "District", value: districts.find((d) => d.id === filters.districtId)?.nameEn ?? filters.districtId });
  }
  if (filters.societyId !== "all") {
    activeFilters.push({ id: "societyId", label: "Society", value: societies.find((s) => s.id === filters.societyId)?.name ?? filters.societyId });
  }
  if (filters.type !== "all") activeFilters.push({ id: "type", label: "Type", value: typeLabel(filters.type) });
  if (filters.status !== "all") {
    activeFilters.push({ id: "status", label: "Status", value: DOCUMENT_STATUS_LABELS[filters.status as DocumentStatus] });
  }

  function removeFilter(id: string) {
    update({ [id]: id === "query" ? "" : "all" } as Partial<DocumentFilters>);
  }

  function clearAllFilters() {
    setFilters(EMPTY_DOCUMENT_FILTERS);
    searchInput.current?.focus();
  }

  return (
    <div className="mt-6 space-y-5">
      {registrarRecords && registrarRecords.length > 0 && (
        <section
          aria-labelledby="library-registrar-strip"
          className="rounded-xl border border-[#dfe5dc] bg-white p-5 shadow-[0_8px_26px_rgba(24,56,35,0.04)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#223329]" id="library-registrar-strip">
              Annual documents to the Registrar · {COMPLIANCE_YEAR}
            </h2>
            <p className="text-xs text-[#68756c]">
              <strong className="text-[#223329]">{countFullyCompliant(registrarRecords)} of {registrarRecords.length}</strong> societies have all four approved ·{" "}
              <Link className="font-semibold text-[#26744b] hover:underline" href="/compliance">Open compliance</Link>
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {REGISTRAR_DOCUMENTS.map((document, index) => {
              const sent = registrarRecords.filter((record) => record.requirements[document.type].status !== "NOT_SUBMITTED").length;
              return (
                <div className="rounded-lg border border-[#e4e8e2] bg-[#fbfcfa] p-3" key={document.type}>
                  <span className="block text-xs font-semibold text-[#2c3c32]">{index + 1} · {document.label}</span>
                  <span className="mt-1 block text-lg font-semibold text-[#174a32]">
                    {sent}
                    <span className="text-xs font-normal text-[#738078]"> / {registrarRecords.length} sent</span>
                  </span>
                  <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#e4e9e2]">
                    <span className="block h-full rounded-full bg-[#2f7c4f]" style={{ width: `${(sent / registrarRecords.length) * 100}%` }} />
                  </span>
                  <span className="mt-2 block text-[11px] text-[#738078]">{document.note}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {roleNotice && (
        <p className="flex items-start gap-2 rounded-lg border border-[#c8d9ea] bg-[#eef4fa] px-4 py-3 text-xs leading-5 text-[#2d4f70]">
          <Icon className="mt-0.5 size-4 shrink-0" name="lock" />
          {roleNotice}
        </p>
      )}

      {documents.length === 0 ? (
        <section className="overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
          <EmptyState
            description="Documents appear here when societies in your area upload them from the mobile app."
            icon="document"
            title="No documents yet"
          />
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-5">
            <nav aria-label="Document categories" className="h-fit rounded-xl border border-[#dfe5dc] bg-white p-2 shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
              <ul className="space-y-1">
                {[{ value: "all", label: "All documents" }, ...typesInView].map((type) => {
                  const active = filters.type === type.value;
                  const count =
                    type.value === "all"
                      ? [...countsByType.values()].reduce((sum, value) => sum + value, 0)
                      : (countsByType.get(type.value) ?? 0);
                  return (
                    <li key={type.value}>
                      <button
                        aria-pressed={active}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26744b] ${
                          active ? "bg-[#e6f0e7] text-[#123d29]" : "text-[#3e4b43] hover:bg-[#f4f8f3]"
                        }`}
                        onClick={() => update({ type: type.value })}
                        type="button"
                      >
                        {type.label}
                        <span className="text-[#738078]">{count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <aside
              aria-label="Document preview"
              className={`h-fit rounded-xl border border-[#dfe5dc] bg-white p-4 shadow-[0_8px_26px_rgba(24,56,35,0.04)] ${
                selected ? "" : "hidden lg:block"
              }`}
            >
              {selected ? (
                <DocumentPreview document={selected.document} />
              ) : (
                <p className="py-8 text-center text-xs leading-5 text-[#738078]">
                  Choose a document to see its details.
                </p>
              )}
            </aside>
          </div>

          <section className="min-w-0 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
            <div className="grid gap-3 border-b border-[#e4e8e2] p-4 md:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_150px_200px_150px]">
              <label className="relative block md:col-span-3 2xl:col-span-1">
                <span className="sr-only">Search documents</span>
                <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78857d]" name="search" />
                <input
                  className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
                  onChange={(event) => update({ query: event.target.value })}
                  placeholder="Search names, societies and scanned text"
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
                <span className="sr-only">Filter by society</span>
                <select
                  className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
                  onChange={(event) => update({ societyId: event.target.value })}
                  value={filters.societyId}
                >
                  <option value="all">All societies</option>
                  {societies.map((society) => (
                    <option key={society.id} value={society.id}>{society.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by status</span>
                <select
                  className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
                  onChange={(event) => update({ status: event.target.value })}
                  value={filters.status}
                >
                  <option value="all">All statuses</option>
                  {(["SUBMITTED", "REJECTED", "APPROVED"] as const).map((status) => (
                    <option key={status} value={status}>{DOCUMENT_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
            </div>

            {matches.length === 0 ? (
              <NoResultsState
                filters={activeFilters}
                itemLabel="documents"
                onClearAll={clearAllFilters}
                onRemoveFilter={removeFilter}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <caption className="sr-only">Society documents</caption>
                  <thead className="bg-[#f7f8f5] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#738078]">
                    <tr>
                      <th className="px-5 py-3" scope="col">Document</th>
                      <th className="px-4 py-3" scope="col">Society</th>
                      <th className="px-4 py-3" scope="col">Type</th>
                      <th className="px-4 py-3" scope="col">Status</th>
                      <th className="px-4 py-3" scope="col">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0eb]">
                    {matches.map(({ document, matchedInText }) => {
                      const isSelected = document.id === selectedId;
                      return (
                        <tr
                          className={`transition ${isSelected ? "bg-[#f1f8f2]" : "hover:bg-[#f8faf6]"}`}
                          key={document.id}
                        >
                          <th className="px-5 py-3 text-left font-normal" scope="row">
                            <button
                              aria-label={`Preview ${document.title} from ${document.societyName}`}
                              aria-pressed={isSelected}
                              className="flex items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26744b]"
                              onClick={() => setSelectedId(isSelected ? null : document.id)}
                              type="button"
                            >
                              <Icon className="mt-0.5 size-4 shrink-0 text-[#26744b]" name="document" />
                              <span>
                                <span className="block text-sm font-semibold text-[#223329]">{document.title}</span>
                                <span className="mt-0.5 block text-[11px] text-[#748078]">
                                  v{document.version}
                                  {document.reviewersOnly && " · District Manager and HQ only"}
                                </span>
                                {matchedInText && (
                                  <span className="mt-1 inline-block rounded bg-[#eef4fa] px-1.5 py-0.5 text-[10px] font-semibold text-[#2d4f70]">
                                    Found in scanned text
                                  </span>
                                )}
                              </span>
                            </button>
                          </th>
                          <td className="px-4 py-3 text-xs text-[#4d5b52]">
                            <span className="block font-medium">{document.societyName.replace(" Sarvodaya Shramadana Society", " SSS")}</span>
                            <span className="text-[#748078]">{document.districtName}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#4d5b52]">{typeLabel(document.type)}</td>
                          <td className="px-4 py-3"><DocumentStatusBadge status={document.status} /></td>
                          <td className="px-4 py-3 text-xs text-[#617067]">
                            <span className="block">{dateFormat.format(new Date(document.uploadedAt))}</span>
                            <span className="text-[#748078]">{document.uploadedBy}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-[#e8ece6] px-5 py-3 text-xs text-[#738078]">
              <p aria-live="polite" role="status">
                Showing {matches.length} of {documents.length} documents
              </p>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

function DocumentPreview({ document }: { document: LibraryDocument }) {
  return (
    <div>
      <div aria-hidden="true" className="grid h-32 place-items-center rounded-lg bg-[#f2f5f0] text-[11px] text-[#7a867e]">
        <Icon className="size-8 text-[#9db3a3]" name="document" />
      </div>
      <h2 className="mt-4 text-sm font-semibold text-[#223329]">{document.title}</h2>
      <dl className="mt-3 space-y-2 text-xs">
        {[
          ["Society", `${document.societyName} (${document.societyCode})`],
          ["District", document.districtName],
          ["Type", typeLabel(document.type)],
          ["File", document.fileName],
          ["Uploaded", `${dateFormat.format(new Date(document.uploadedAt))} by ${document.uploadedBy}`],
          ["Access", document.reviewersOnly ? "District Manager and HQ only" : "Society, District Centre and HQ"],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="text-[#748078]">{term}</dt>
            <dd className="font-medium text-[#2c3c32]">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-[#748078]">Status</dt>
          <dd className="mt-1"><DocumentStatusBadge status={document.status} /></dd>
        </div>
      </dl>
      <p className="mt-3 rounded-lg bg-[#f7f8f5] p-3 text-[11px] leading-5 text-[#5f6d64]">{document.extractedText}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          aria-describedby="download-note"
          className={`${primaryButtonClass} px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60`}
          disabled
          type="button"
        >
          Download
        </button>
        <Link className={`${secondaryButtonClass} px-3 py-2 text-xs`} href={`/societies/${document.societyId}`}>
          Open society
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-[#738078]" id="download-note">
        Downloads are switched off for the demonstration files.
      </p>
    </div>
  );
}
