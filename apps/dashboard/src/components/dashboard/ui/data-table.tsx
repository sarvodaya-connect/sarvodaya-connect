import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Thin table primitives. Not a data-grid — just the shared chrome so every
 * screen's table has the same borders, row height, hover tint, and header
 * typography. Compose with regular `<table>` semantics.
 */
export function DataTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-surface ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface-muted">{children}</thead>;
}

export function Th({ children, className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-line-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line-soft">{children}</tbody>;
}

export function Tr({ children, className = "", ...rest }: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return (
    <tr className={`transition hover:bg-brand-mint-soft ${className}`} {...rest}>
      {children}
    </tr>
  );
}

export function Td({ children, className = "", ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
  return (
    <td className={`px-4 py-3 text-[13px] text-ink ${className}`} {...rest}>
      {children}
    </td>
  );
}
