"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type RecordTab = { count?: number; href: string; label: string };

/** D05 tab row: Overview, Exco, Work plan, Documents, Grade and History. */
export function RecordTabs({ tabs }: { tabs: RecordTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Society record sections" className="flex overflow-x-auto border-b border-line">
      {tabs.map((tab, index) => {
        const active = index === 0 ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[12px] transition ${
              active
                ? "border-brand-forest font-semibold text-ink"
                : "border-transparent text-ink-soft hover:text-brand-forest"
            }`}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span className="rounded-full bg-[#eef1ec] px-1.5 text-[10px] font-bold text-ink-soft">{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
