"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { ReviewQueueItem } from "@/lib/demo-registry";

import { type ActiveFilter, EmptyState, NoResultsState } from "./data-states";
import { Icon } from "./icon";
import { Pill, type PillTone } from "./ui/pill";

type FilterId = "all" | "past-target" | "committee" | "activities" | "payments";

function targetStatus(submittedAt: string): "on-time" | "due-today" | "past-target" {
  const submitted = new Date(submittedAt).getTime();
  if (!Number.isFinite(submitted)) return "on-time";
  const ageHours = (Date.now() - submitted) / 3_600_000;
  if (ageHours > 72) return "past-target";
  if (ageHours > 48) return "due-today";
  return "on-time";
}

const targetMeta: Record<ReturnType<typeof targetStatus>, { tone: PillTone; label: string }> = {
  "on-time": { tone: "on-time", label: "On time" },
  "due-today": { tone: "fast-target", label: "Due today" },
  "past-target": { tone: "overdue", label: "Past target" },
};

export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FilterId>("all");
  const searchInput = useRef<HTMLInputElement>(null);

  const pastTargetCount = useMemo(
    () => items.filter((item) => targetStatus(item.submittedAt) === "past-target").length,
    [items],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !normalized ||
        item.societyName.toLowerCase().includes(normalized) ||
        item.reference.toLowerCase().includes(normalized);
      const matchesTab =
        tab === "all" ||
        (tab === "past-target" && targetStatus(item.submittedAt) === "past-target") ||
        (tab === "committee" && item.type === "Committee update") ||
        (tab === "activities" && item.type === "Activity report") ||
        (tab === "payments" && item.type === "Payment");
      return matchesSearch && matchesTab;
    });
  }, [items, query, tab]);

  const activeFilters: ActiveFilter[] = [];
  if (query.trim()) activeFilters.push({ id: "query", label: "Search", value: `“${query.trim()}”` });
  if (tab !== "all") {
    const label = { "past-target": "Past target", committee: "Committee", activities: "Activities", payments: "Payments" }[tab];
    activeFilters.push({ id: "tab", label: "View", value: label });
  }

  function removeFilter(id: string) {
    if (id === "query") setQuery("");
    if (id === "tab") setTab("all");
  }

  function clearAllFilters() {
    setQuery("");
    setTab("all");
    searchInput.current?.focus();
  }

  if (items.length === 0) {
    return (
      <section className="mt-6 overflow-hidden rounded-card border border-line bg-surface">
        <EmptyState
          description="New committee updates and activity reports from societies will appear here for District Manager review."
          icon="review"
          title="No submissions waiting for review"
        />
      </section>
    );
  }

  const tabs: { id: FilterId; label: string; count?: number }[] = [
    { id: "all", label: "All", count: items.length },
    { id: "past-target", label: "Past target", count: pastTargetCount },
    { id: "committee", label: "Committee" },
    { id: "activities", label: "Activities" },
    { id: "payments", label: "Payments" },
  ];

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Waiting" value={items.length.toString()} />
        <Kpi label="Past 3-day target" value={pastTargetCount.toString()} tone={pastTargetCount > 0 ? "warning" : "neutral"} />
        <Kpi label="Approved this week" value="54" />
        <Kpi label="Returned this week" value="9" />
      </div>

      <section className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <nav aria-label="Review filter" className="flex flex-wrap gap-5 self-end">
            {tabs.map((item) => (
              <button
                aria-pressed={tab === item.id}
                className={`-mb-[17px] border-b-2 pb-3 text-[12px] transition ${
                  tab === item.id
                    ? "border-brand-forest font-semibold text-ink"
                    : "border-transparent text-ink-soft hover:text-brand-forest"
                }`}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                {item.label}
                {typeof item.count === "number" && ` (${item.count})`}
              </button>
            ))}
          </nav>
          <label className="relative w-full max-w-xs">
            <span className="sr-only">Search submissions</span>
            <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" name="search" />
            <input
              className="w-full rounded-button border border-line bg-surface py-1.5 pl-9 pr-3 text-[12px] outline-none focus:border-brand-leaf focus:ring-3 focus:ring-[#dbeadd]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search society or submission reference"
              ref={searchInput}
              type="search"
              value={query}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <NoResultsState
            filters={activeFilters}
            itemLabel="submissions"
            onClearAll={clearAllFilters}
            onRemoveFilter={removeFilter}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <caption className="sr-only">Submissions awaiting review</caption>
              <thead className="bg-surface-muted text-[12px] font-medium text-ink-soft">
                <tr>
                  <th className="px-5 py-3" scope="col">Type</th>
                  <th className="px-5 py-3" scope="col">Society</th>
                  <th className="px-5 py-3" scope="col">Sent by</th>
                  <th className="px-5 py-3" scope="col">Waiting</th>
                  <th className="px-5 py-3" scope="col">Target</th>
                  <th className="px-5 py-3 text-right" scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filtered.map((item) => {
                  const target = targetMeta[targetStatus(item.submittedAt)];
                  return (
                    <tr className="transition hover:bg-brand-mint-soft" key={item.id}>
                      <td className="px-5 py-2.5 text-[12.5px] text-ink">{item.type}</td>
                      <td className="px-5 py-2.5">
                        <Link
                          className="text-[12.5px] text-[#2d5c88] underline underline-offset-2"
                          href={`/societies/${item.societyId}`}
                          title={`${item.societyCode} · ${item.reference}`}
                        >
                          {item.societyName.replace("Sarvodaya Shramadana Society", "SSS")}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-[12.5px] text-ink-soft">{item.submittedBy ?? "—"}</td>
                      <td className="px-5 py-3 text-[12px] text-ink-soft">{item.waitingLabel}</td>
                      <td className="px-5 py-3"><Pill tone={target.tone}>{target.label}</Pill></td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          aria-label={`Review ${item.reference} from ${item.societyName}`}
                          className="inline-flex items-center gap-1 rounded-button bg-brand-action px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-action-pressed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]"
                          href={`/reviews/${item.id}`}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line-soft px-5 py-3 text-[12px] text-muted">
          <p aria-live="polite" role="status">Showing {filtered.length} of {items.length} submissions</p>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "warning"; value: string }) {
  return (
    <article className="rounded-tile border border-line bg-surface px-4 py-3.5">
      <p className="text-[11px] text-muted">{label}</p>
      <strong className={`mt-1.5 block text-[24px] font-bold tracking-[-0.02em] ${tone === "warning" ? "text-danger-text" : "text-ink"}`}>
        {value}
      </strong>
    </article>
  );
}
