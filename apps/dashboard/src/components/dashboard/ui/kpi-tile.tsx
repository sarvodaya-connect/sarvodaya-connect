import type { ReactNode } from "react";

/**
 * KPI tile used across role homes (D02, D02b, D02c) and module headers
 * (D06, D08, D09, D11, D14b). Big number top-left, label beneath, optional
 * supporting line, optional trailing bar/trend.
 */
export function KpiTile({
  change,
  label,
  trailing,
  value,
}: {
  change?: { direction?: "up" | "down" | "flat"; label: string };
  label: string;
  trailing?: ReactNode;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-tile border border-line bg-surface px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <div className="flex items-baseline justify-between gap-3">
        <strong className="text-[28px] font-bold tracking-[-0.02em] text-ink md:text-[32px]">
          {value}
        </strong>
        {change && <ChangeChip {...change} />}
      </div>
      {trailing && <div className="mt-1 text-[11px] text-muted">{trailing}</div>}
    </div>
  );
}

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}

function ChangeChip({ direction = "flat", label }: { direction?: "up" | "down" | "flat"; label: string }) {
  const toneClass =
    direction === "up"
      ? "bg-success-bg text-success-text"
      : direction === "down"
        ? "bg-danger-bg text-danger-text"
        : "bg-[#f0f1ee] text-muted";
  const glyph = direction === "up" ? "↑" : direction === "down" ? "↓" : "·";
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
      <span aria-hidden="true">{glyph}</span>
      {label}
    </span>
  );
}
