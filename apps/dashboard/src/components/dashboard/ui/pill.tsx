import type { ReactNode } from "react";

/**
 * Semantic pill tones from Screen Catalogue v3.
 * The catalogue uses a dot for list-row status indicators and a solid chip
 * (no dot) for emphasis badges — `dot` is on by default; set `dot={false}`
 * for the solid variant.
 */
export type PillTone =
  | "on-time"
  | "fast-target"
  | "overdue"
  | "under-review"
  | "approved"
  | "returned"
  | "not-reported"
  | "verified"
  | "unverified"
  | "inactive"
  | "info"
  // Catalogue meta pills
  | "mvp"
  | "optional"
  | "preview"
  | "later"
  | "changed";

const toneClass: Record<PillTone, string> = {
  "on-time": "bg-success-bg text-success-text ring-1 ring-inset ring-[var(--success-ring)]",
  "fast-target": "bg-warn-bg text-warn-text ring-1 ring-inset ring-[var(--warn-ring)]",
  overdue: "bg-danger-bg text-danger-text ring-1 ring-inset ring-[var(--danger-text)]/15",
  "under-review": "bg-info-bg text-info-text ring-1 ring-inset ring-[var(--info-ring)]",
  approved: "bg-brand-leaf text-white",
  returned: "bg-orange-changed-soft text-orange-changed ring-1 ring-inset ring-[var(--orange-changed)]/25",
  "not-reported": "bg-danger-bg text-danger-text ring-1 ring-inset ring-[var(--danger-text)]/15",
  verified: "bg-success-bg text-success-text ring-1 ring-inset ring-[var(--success-ring)]",
  unverified: "bg-[#fff0e5] text-[#92511f] ring-1 ring-inset ring-[#f0d3bc]",
  inactive: "bg-[#f0f1ee] text-[#667168] ring-1 ring-inset ring-[#dde1dc]",
  info: "bg-info-bg text-info-text ring-1 ring-inset ring-[var(--info-ring)]",
  mvp: "bg-brand-forest text-white",
  optional: "border border-brand-leaf text-brand-leaf",
  preview: "border border-[var(--warn-text)] text-warn-text",
  later: "border border-line text-muted",
  changed: "bg-orange-changed text-white",
};

export function Pill({
  children,
  dot = true,
  size = "sm",
  tone,
}: {
  children: ReactNode;
  dot?: boolean;
  size?: "sm" | "md";
  tone: PillTone;
}) {
  const pad = size === "md" ? "px-3 py-1 text-[11px]" : "px-2.5 py-0.5 text-[10px]";
  const useDot = dot && tone !== "approved" && tone !== "mvp" && tone !== "changed";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill font-semibold ${pad} ${toneClass[tone]}`}
    >
      {useDot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-75" />}
      {children}
    </span>
  );
}

/**
 * Filter chip — toggles between outline (inactive) and forest-filled (active).
 * Matches the review-queue and tracker filter rows in the catalogue.
 */
export function FilterChip({
  active = false,
  children,
  count,
  onClick,
  type = "button",
}: {
  active?: boolean;
  children: ReactNode;
  count?: number;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-brand-forest text-white"
          : "border border-line bg-surface text-ink-soft hover:border-brand-leaf hover:text-brand-leaf"
      }`}
      onClick={onClick}
      type={type}
    >
      {children}
      {typeof count === "number" && (
        <span
          className={`rounded-full px-1.5 text-[10px] font-bold ${
            active ? "bg-white/15 text-white" : "bg-brand-mint text-brand-forest"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
