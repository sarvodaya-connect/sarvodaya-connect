import Link from "next/link";

import type { SearchResultType } from "@sarvodaya-connect/api-contracts";

import { EmptyState } from "@/components/dashboard/data-states";
import { Icon, type IconName } from "@/components/dashboard/icon";
import { first } from "@/components/dashboard/national/parts";
import { Pill, type PillTone } from "@/components/dashboard/ui/pill";
import { getCurrentViewer } from "@/lib/current-viewer";
import { searchRecords } from "@/lib/national-api";

const TYPES: { key: SearchResultType; label: string; icon: IconName }[] = [
  { key: "society", label: "Societies", icon: "home" },
  { key: "person", label: "People", icon: "user" },
  { key: "document", label: "Documents", icon: "document" },
  { key: "activity", label: "Activities", icon: "clipboard" },
  { key: "request", label: "Requests", icon: "flag" },
];

function tone(status: string): PillTone {
  if (status.startsWith("Waiting")) return "fast-target";
  if (status.startsWith("Not") || status.includes("disabled")) return "inactive";
  if (status === "Exco" || status.includes("pending")) return "info";
  return "on-time";
}

/** V5 D18 Search: what the user may open, from approved records. NICs and phone numbers are never searched. */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await getCurrentViewer();
  const params = await searchParams;
  const query = (first(params.q) ?? "").trim();
  const type = TYPES.find((item) => item.key === first(params.type))?.key;
  const results = query.length >= 2 ? await searchRecords(query, type) : null;
  const total = results ? Object.values(results.counts).reduce((sum, value) => sum + value, 0) : 0;
  const href = (key?: SearchResultType) => `/search?q=${encodeURIComponent(query)}${key ? `&type=${key}` : ""}`;

  return (
    <>
      <h1 className="text-[22px] font-bold text-ink">Search</h1>
      <p className="text-[12px] text-ink-soft">Societies, people, documents, activities and requests · approved records only</p>
      <form className="mt-4" method="get" role="search">
        <label className="sr-only" htmlFor="search-query">Search</label>
        <div className="flex items-center gap-2 rounded-card border-2 border-brand-forest bg-surface px-4 py-3">
          <Icon className="size-4 text-ink-soft" name="search" />
          <input autoFocus className="flex-1 bg-transparent text-[14px] text-ink outline-none" defaultValue={query} id="search-query" minLength={2} name="q" placeholder="A name, S number, district or person" />
        </div>
      </form>

      {!results ? (
        <div className="mt-4">
          <EmptyState description="Type at least two letters: a society name, S number, district or person." icon="search" title="Search the records you can open" />
        </div>
      ) : (
        <>
          <nav aria-label="Result types" className="mt-4 flex flex-wrap gap-2">
            <Link aria-current={!type ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${!type ? "border-brand-forest bg-brand-forest text-white" : "border-line bg-surface text-ink"}`} href={href()}>
              All ({total})
            </Link>
            {TYPES.map((item) => (
              <Link aria-current={type === item.key ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${type === item.key ? "border-brand-forest bg-brand-forest text-white" : "border-line bg-surface text-ink"}`} href={href(item.key)} key={item.key}>
                {item.label} ({results.counts[item.key]})
              </Link>
            ))}
          </nav>
          <p className="mt-3 text-[11px] text-muted" role="status">
            {total} {total === 1 ? "result" : "results"} for “{results.query}”{results.data.length < (type ? results.counts[type] : total) ? ` · showing the first ${results.data.length}` : ""}
          </p>
          {results.data.length === 0 ? (
            <div className="mt-3">
              <EmptyState description="Try a name, S number, district or person. Only records you can open are searched." icon="search" title="No results" />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line-soft rounded-card border border-line bg-surface">
              {results.data.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <Link className="flex items-center gap-3 px-4 py-3 hover:bg-brand-mint-soft" href={result.href}>
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef3ee] text-brand-forest">
                      <Icon className="size-4" name={TYPES.find((item) => item.key === result.type)!.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-[13px] text-ink">{result.title}</strong>
                      <span className="block truncate text-[11px] text-muted">{result.subtitle}</span>
                    </span>
                    {result.status && <Pill tone={tone(result.status)}>{result.status}</Pill>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-[#f4f5f1] px-3 py-2 text-[11px] text-ink-soft">
        <Icon className="size-3.5" name="help" />
        NIC numbers, phone numbers and addresses are never searched or shown here.
      </p>
    </>
  );
}
