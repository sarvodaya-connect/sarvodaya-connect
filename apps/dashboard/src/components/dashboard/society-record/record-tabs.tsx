"use client";

import { usePathname } from "next/navigation";

import { useI18n } from "@/i18n/provider";

import { TabLinks } from "../ui/nav-segments";

export type RecordTab = { count?: number; href: string; label: string };

/**
 * D05 tab row: Overview, Exco, Work plan, Documents, Grade and History.
 * Issue #179: the role homes' tabs, whose indicator moves to the chosen tab
 * at once while the page loads (no slide under reduced motion).
 */
export function RecordTabs({ tabs }: { tabs: RecordTab[] }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <TabLinks
      items={tabs.map((tab, index) => ({
        href: tab.href,
        key: tab.href,
        label: tab.label,
        count: typeof tab.count === "number" ? tab.count : undefined,
        current: index === 0 ? pathname === tab.href : pathname.startsWith(tab.href),
      }))}
      label={t("sr.tabsLabel")}
      loadingLabel={t("st.loading")}
    />
  );
}
