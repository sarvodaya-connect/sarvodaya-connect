import type { ReactNode } from "react";

/**
 * Shared card chrome used by section panels across the dashboard (14px radius,
 * 1px #DFE5DC border, white surface, flat elevation). Optional heading row
 * matches the catalogue's "Section title · optional action" pattern.
 */
export function SectionCard({
  action,
  children,
  description,
  padded = true,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: string;
  padded?: boolean;
  title?: string;
}) {
  return (
    <section className="rounded-card border border-line bg-surface">
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 md:px-6">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink md:text-base">{title}</h2>
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={padded ? "px-5 py-5 md:px-6" : ""}>{children}</div>
    </section>
  );
}
