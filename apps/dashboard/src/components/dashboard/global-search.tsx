import Link from "next/link";

import type { RegistrySearchResult } from "@/lib/registry-search";

import { EmptyState } from "./data-states";

export function GlobalSearchResults({ query, results }: { query: string; results: RegistrySearchResult[] }) {
  if (!query.trim()) {
    return (
      <section className="mt-6 rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
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
      <section className="mt-6 rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <EmptyState
          description={`No permitted society records matched “${query}”. Try another name, ID, person or document.`}
          icon="search"
          title="No search results"
        />
      </section>
    );
  }

  return (
    <section aria-label="Global search results" className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <div className="border-b border-[#e4e8e2] px-5 py-4 text-sm text-[#657268]" role="status">
        {results.length} matching records for <strong className="text-[#26372d]">{query}</strong>
      </div>
      <ul className="divide-y divide-[#edf0eb]">
        {results.map((result, index) => (
          <li key={`${result.societyId}-${result.kind}-${result.title}-${index}`}>
            <Link className="block px-5 py-4 transition hover:bg-[#f8faf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#26744b]" href={`/societies/${result.societyId}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#e6f0e7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#25643f]">{result.kind}</span>
                <span className="text-xs text-[#77837b]">{result.societyName} · {result.societyCode}</span>
              </div>
              <strong className="mt-2 block text-sm font-semibold text-[#25362c]">{result.title}</strong>
              <p className="mt-1 text-xs text-[#68756c]">{result.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
