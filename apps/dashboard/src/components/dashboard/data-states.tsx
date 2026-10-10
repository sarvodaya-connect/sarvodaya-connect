import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

/** Shared button styles so every state action looks and focuses the same way. */
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f6b43] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#174f34] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#ccd6ce] bg-white px-4 py-2.5 text-sm font-semibold text-[#26362c] transition hover:bg-[#f4f8f3] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd]";

/**
 * Placeholder rows shown while registry data is loading. The visual rows are
 * hidden from assistive technology; a single status message is announced instead.
 */
export function TableSkeleton({
  columns = 5,
  label = "Loading societies",
  rows = 5,
}: {
  columns?: number;
  label?: string;
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]"
      role="status"
    >
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true">
        <div className="grid gap-3 border-b border-[#e4e8e2] p-4 md:grid-cols-[minmax(240px,1fr)_180px_170px]">
          {[0, 1, 2].map((item) => (
            <div className="h-10 rounded-lg bg-[#eef1ec] motion-safe:animate-pulse" key={item} />
          ))}
        </div>
        <div className="h-10 bg-[#f7f8f5]" />
        <div className="divide-y divide-[#edf0eb]">
          {Array.from({ length: rows }, (_, row) => (
            <div className="flex items-center gap-6 px-5 py-4" key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <div
                  className={`h-3 rounded-full bg-[#e9ede6] motion-safe:animate-pulse ${column === 0 ? "w-2/5" : "w-1/6"}`}
                  key={column}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StateIcon({ name, tone = "neutral" }: { name: IconName; tone?: "neutral" | "error" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-12 place-items-center rounded-full ${
        tone === "error" ? "bg-[#fbe9e4] text-[#a8402c]" : "bg-[#e6f0e7] text-[#26744b]"
      }`}
    >
      <Icon className="size-6" name={name} />
    </span>
  );
}

/** Shown when a list has no records at all (not caused by filters). */
export function EmptyState({
  action,
  description,
  icon = "inbox",
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: IconName;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <StateIcon name={icon} />
      <h2 className="mt-4 text-base font-semibold text-[#223329]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#68756c]">{description}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

/**
 * Shown when data could not be loaded. Technical error details are never shown;
 * only the optional reference (Next.js error digest) so staff can report it.
 */
export function ErrorState({
  description = "The dashboard could not load this information. Your data has not been changed. Please try again.",
  onRetry,
  reference,
  retryLabel = "Try again",
  secondaryAction,
  title = "Something went wrong",
}: {
  description?: string;
  onRetry: () => void;
  reference?: string;
  retryLabel?: string;
  secondaryAction?: ReactNode;
  title?: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center" role="alert">
      <StateIcon name="alert" tone="error" />
      <h2 className="mt-4 text-base font-semibold text-[#223329]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#68756c]">{description}</p>
      {reference && (
        <p className="mt-2 text-xs text-[#7b877f]">
          Reference: <code className="font-mono">{reference}</code>
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button className={primaryButtonClass} onClick={onRetry} type="button">
          <Icon className="size-4" name="refresh" />
          {retryLabel}
        </button>
        {secondaryAction}
      </div>
    </div>
  );
}

export type ActiveFilter = {
  id: string;
  label: string;
  value: string;
};

/** Shown when records exist but the current search or filters match none of them. */
export function NoResultsState({
  filters,
  itemLabel,
  onClearAll,
  onRemoveFilter,
}: {
  filters: ActiveFilter[];
  itemLabel: string;
  onClearAll: () => void;
  onRemoveFilter: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <StateIcon name="search" />
      <h2 className="mt-4 text-base font-semibold text-[#223329]">No {itemLabel} match your filters</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#68756c]">
        Try a different search term, or remove one of the filters below.
      </p>
      {filters.length > 0 && (
        <ul aria-label="Active filters" className="mt-5 flex flex-wrap justify-center gap-2">
          {filters.map((filter) => (
            <li
              className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe0d1] bg-[#f4f8f3] py-1 pl-3 pr-1 text-xs text-[#2f4a39]"
              key={filter.id}
            >
              <span className="font-semibold">{filter.label}:</span>
              <span>{filter.value}</span>
              <button
                aria-label={`Remove ${filter.label} filter`}
                className="grid size-6 place-items-center rounded-full text-[#4d6455] transition hover:bg-[#e1ece2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26744b]"
                onClick={() => onRemoveFilter(filter.id)}
                type="button"
              >
                <Icon className="size-3.5" name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className={`${secondaryButtonClass} mt-6`} onClick={onClearAll} type="button">
        Clear all filters
      </button>
    </div>
  );
}
