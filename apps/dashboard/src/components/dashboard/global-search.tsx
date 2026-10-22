"use client";

import Link from "next/link";
import { useState } from "react";

import type { RegistrySearchResult } from "@/lib/registry-search";

import { EmptyState } from "./data-states";
import { Pill } from "./ui/pill";

type TabId = "all" | "societies" | "people" | "documents" | "records";

const tabsConfig: { id: TabId; label: string; kinds: RegistrySearchResult["kind"][] }[] = [
  { id: "all", label: "All", kinds: ["Society", "Contact", "Committee", "Document", "History"] },
  { id: "societies", label: "Societies", kinds: ["Society"] },
  { id: "people", label: "People", kinds: ["Contact", "Committee"] },
  { id: "documents", label: "Documents", kinds: ["Document"] },
  { id: "records", label: "Records", kinds: ["History"] },
];

const kindTone: Record<RegistrySearchResult["kind"], { bg: string; text: string }> = {
  Society: { bg: "bg-brand-mint", text: "text-brand-forest" },
  Contact: { bg: "bg-[#f3e4f2]", text: "text-[#7a2976]" },
  Committee: { bg: "bg-[#f3e4f2]", text: "text-[#7a2976]" },
  Document: { bg: "bg-info-bg", text: "text-info-text" },
  History: { bg: "bg-warn-bg", text: "text-warn-text" },
};

function initialsFor(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function GlobalSearchResults({ query, results }: { query: string; results: RegistrySearchResult[] }) {
  const [tab, setTab] = useState<TabId>("all");

  if (!query.trim()) {
    return (
      <section className="mt-6 rounded-card border border-line bg-surface">
        <EmptyState
          description="Search society names and IDs, locations, contacts, committee members, documents and profile history."
          icon="search"
          title="Search the society registry"
        />
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="mt-6 rounded-card border border-line bg-surface">
        <EmptyState
          description={`No permitted society records matched “${query}”. Try another name, ID, person or document.`}
          icon="search"
          title="No search results"
        />
      </section>
    );
  }

  const activeTab = tabsConfig.find((item) => item.id === tab)!;
  const filtered = results.filter((result) => activeTab.kinds.includes(result.kind));
  const tabCounts: Record<TabId, number> = {
    all: results.length,
    societies: results.filter((r) => r.kind === "Society").length,
    people: results.filter((r) => r.kind === "Contact" || r.kind === "Committee").length,
    documents: results.filter((r) => r.kind === "Document").length,
    records: results.filter((r) => r.kind === "History").length,
  };

  return (
    <section aria-label="Global search results" className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <nav aria-label="Result filter" className="flex flex-wrap gap-2">
          {tabsConfig.map((item) => (
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
              <span
                className={`rounded-full px-1.5 text-[10px] font-bold ${
                  tab === item.id ? "bg-white/15 text-white" : "bg-brand-mint text-brand-forest"
                }`}
              >
                {tabCounts[item.id]}
              </span>
            </button>
          ))}
        </nav>
        <p className="text-[12px] text-muted" role="status">
          {filtered.length} results for <strong className="text-ink">{query}</strong>
        </p>
      </header>
      {filtered.length === 0 ? (
        <div className="px-5 py-12 text-center text-[13px] text-muted">
          No {activeTab.label.toLowerCase()} match “{query}”.
        </div>
      ) : (
        <ul className="divide-y divide-line-soft">
          {filtered.map((result, index) => {
            const tone = kindTone[result.kind];
            return (
              <li key={`${result.societyId}-${result.kind}-${result.title}-${index}`}>
                <Link
                  className="flex items-start gap-3 px-5 py-4 transition hover:bg-brand-mint-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-leaf"
                  href={`/societies/${result.societyId}`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ${tone.bg} ${tone.text}`}
                  >
                    {initialsFor(result.title)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[14px] font-semibold text-ink">{result.title}</strong>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {result.kind} · {result.societyName} · {result.societyCode}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">{result.description}</p>
                  </div>
                  <Pill tone={result.kind === "Society" ? "on-time" : "info"}>
                    {result.kind}
                  </Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <footer className="border-t border-line-soft bg-surface-muted px-5 py-3 text-[11px] text-muted">
        Phone numbers are replaced with <strong className="text-ink-soft">+94 00 000 000x</strong> placeholders in the demonstration.
      </footer>
    </section>
  );
}
