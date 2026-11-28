import type { CSSProperties, ReactNode } from "react";

import styles from "./surface.module.css";

/**
 * Shared card chrome for section panels across the dashboard. Issue #179:
 * the modern style of the HQ and role home dashboards (16px radius, soft
 * elevation). The optional `eyebrow` (and `n`, a step number) gives the same
 * heading as the home cards: a small green label above a bold title.
 */
export function SectionCard({
  action,
  children,
  className = "",
  description,
  eyebrow,
  headingLevel = 2,
  id,
  n,
  order,
  padded = true,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  headingLevel?: 2 | 3;
  id?: string;
  n?: number;
  /** Entrance order (0–6): blocks settle in once, a short step apart. */
  order?: number;
  padded?: boolean;
  title?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const enter = order === undefined ? "" : styles.enter;
  const style = order === undefined ? undefined : ({ "--i": order } as CSSProperties);
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={`${styles.card} ${enter} min-w-0 ${className}`}
      style={style}
    >
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {n !== undefined && (
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-mint text-[10.5px] font-bold text-brand-forest"
              >
                {n}
              </span>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-leaf">
                  {n !== undefined && <span className="sr-only">{n} · </span>}
                  {eyebrow}
                </p>
              )}
              <Heading className="break-words text-[15px] font-bold leading-snug text-ink" id={id}>
                {title}
              </Heading>
              {description && <p className="mt-1 text-xs text-muted">{description}</p>}
            </div>
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={padded ? "px-5 py-4" : ""}>{children}</div>
    </section>
  );
}

/** A row of filters in a card. Controls wrap onto more rows on narrow widths; none is hidden. */
export function FilterBar({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div aria-label={label} className={`${styles.filters} ${className}`} role="search">
      {children}
    </div>
  );
}

/**
 * Filter inputs and selects, as on the role homes and My Societies (issue
 * #179): 36px high with a green focus ring.
 */
export const fieldClass =
  "h-9 rounded-input border border-line bg-surface px-2.5 text-[12px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";
