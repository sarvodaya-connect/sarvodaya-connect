import type { ReactNode } from "react";
import Link from "next/link";

import { Icon, type IconName } from "./icon";

/** V5 buttons: 38px high, 9px corners, 13px semibold. */
export const primaryButtonClass =
  "inline-flex h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-button border border-brand-action bg-brand-action px-4 text-[13px] font-semibold text-white transition hover:bg-brand-action-pressed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]";

export const secondaryButtonClass =
  "inline-flex h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-button border border-button-line bg-surface px-4 text-[13px] font-semibold text-ink transition hover:bg-brand-mint-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd]";

/**
 * Placeholder rows shown while data is loading (V5 ST01). The visual rows are
 * hidden from assistive technology; a single status message is announced instead.
 */
export function TableSkeleton({
  label = "Loading societies",
  rows = 5,
}: {
  /** Kept for existing callers; V5 skeleton rows have one fixed layout. */
  columns?: number;
  label?: string;
  rows?: number;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="rounded-card border border-line bg-surface p-4"
      role="status"
    >
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, row) => (
          <div className="flex items-center gap-2.5" key={row}>
            <span className="size-[22px] rounded-[5px] bg-state-grey motion-safe:animate-pulse" />
            <span className="flex flex-1 flex-col gap-[5px]">
              <span className="h-2 w-3/5 rounded bg-[#e5e8e1] motion-safe:animate-pulse" />
              <span className="h-1.5 w-[35%] rounded bg-state-grey motion-safe:animate-pulse" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type StateTone = "mint" | "grey" | "danger";

function StateIcon({ name, tone = "mint" }: { name: IconName; tone?: StateTone }) {
  const toneClass = {
    danger: "bg-state-danger text-danger-dot",
    grey: "bg-state-grey text-ink-soft",
    mint: "bg-state-mint text-brand-forest",
  }[tone];
  return (
    <span aria-hidden="true" className={`grid size-[52px] place-items-center rounded-full ${toneClass}`}>
      <Icon className="size-6" name={name} strokeWidth={2} />
    </span>
  );
}

/** V5 state layout: icon circle, bold title, short message and actions, centred. */
function StateLayout({
  actions,
  children,
  heading = "h2",
  icon,
  role,
  title,
  tone,
}: {
  actions?: ReactNode;
  children: ReactNode;
  heading?: "h1" | "h2";
  icon: IconName;
  role?: "alert" | "status";
  title: string;
  tone?: StateTone;
}) {
  const Heading = heading;
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center" role={role}>
      <StateIcon name={icon} tone={tone} />
      <Heading className="text-base font-bold text-ink">{title}</Heading>
      <div className="max-w-[460px] text-[13px] leading-5 text-ink-body">{children}</div>
      {actions && <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Shown when a list has no records at all, not because of filters (V5 D21 "Empty"). */
export function EmptyState({
  action,
  description,
  icon = "flag",
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: IconName;
  title: string;
}) {
  return (
    <StateLayout actions={action} icon={icon} title={title}>
      <p>{description}</p>
    </StateLayout>
  );
}

/**
 * Shown when data could not be loaded (V5 ST03, D21 "Error · retry"). Technical
 * details are never shown; only the optional reference (Next.js error digest)
 * so staff can report it.
 */
export function ErrorState({
  description = "The connection to the server dropped. Nothing you entered was lost.",
  onRetry,
  reference,
  retryLabel = "Try again",
  secondaryAction,
  title = "We couldn’t load this page",
}: {
  description?: string;
  onRetry: () => void;
  reference?: string;
  retryLabel?: string;
  secondaryAction?: ReactNode;
  title?: string;
}) {
  return (
    <StateLayout
      actions={
        <>
          <button className={primaryButtonClass} onClick={onRetry} type="button">
            <Icon className="size-4" name="refresh" strokeWidth={2} />
            {retryLabel}
          </button>
          {secondaryAction}
        </>
      }
      icon="error"
      role="alert"
      title={title}
      tone="danger"
    >
      <p>{description}</p>
      {reference && (
        <p className="mt-1 text-xs text-muted">
          Reference: <code className="font-mono">{reference}</code>
        </p>
      )}
    </StateLayout>
  );
}

/** Shown after an action succeeds (V5 D21 "Success"). */
export function SuccessState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <StateLayout actions={action} icon="success" role="status" title={title}>
      <p>{description}</p>
    </StateLayout>
  );
}

/** Conflict state shown when a record changed after it was opened. */
export function ConflictState({ onReload }: { onReload: () => void }) {
  return (
    <StateLayout
      actions={<button className={secondaryButtonClass} onClick={onReload} type="button">Reload record</button>}
      icon="conflict"
      role="alert"
      title="This record was updated elsewhere"
      tone="grey"
    >
      <p>Your changes have not been saved. Reload the latest version before continuing.</p>
    </StateLayout>
  );
}

/**
 * Shown when the signed-in role cannot open a page or record (V5 ST04, D21
 * "No access", M26 No access). It never names the restricted society, incident
 * or person, so a stale or guessed link reveals nothing. The API refuses the
 * data as well; this is only what the viewer sees.
 */
export function NoAccessState({
  action = <Link className={secondaryButtonClass} href="/dashboard">Back to overview</Link>,
  description = "Your role cannot open it. Ask HQ if you think you need it.",
  heading = "h2",
  title = "You don’t have access to this page",
}: {
  action?: ReactNode;
  description?: string;
  heading?: "h1" | "h2";
  title?: string;
}) {
  return (
    <StateLayout actions={action} heading={heading} icon="lock" role="status" title={title} tone="grey">
      <p>{description}</p>
    </StateLayout>
  );
}

export type ActiveFilter = {
  id: string;
  label: string;
  value: string;
};

/** Shown when records exist but the current search or filters match none of them (V5 ST02). */
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
    <StateLayout
      actions={<button className={primaryButtonClass} onClick={onClearAll} type="button">Clear all filters</button>}
      icon="search"
      title={`No ${itemLabel} match`}
    >
      <p>Try a different search term, or remove one of the filters below.</p>
      {filters.length > 0 && (
        <ul aria-label="Active filters" className="mt-3 flex flex-wrap justify-center gap-2">
          {filters.map((filter) => (
            <li
              className="inline-flex items-center gap-1.5 rounded-full border border-[#cfe0d1] bg-brand-mint-soft py-1 pl-3 pr-1 text-xs text-[#2f4a39]"
              key={filter.id}
            >
              <span className="font-semibold">{filter.label}:</span>
              <span>{filter.value}</span>
              <button
                aria-label={`Remove ${filter.label} filter`}
                className="grid size-6 place-items-center rounded-full text-[#4d6455] transition hover:bg-[#e1ece2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
                onClick={() => onRemoveFilter(filter.id)}
                type="button"
              >
                <Icon className="size-3.5" name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </StateLayout>
  );
}
