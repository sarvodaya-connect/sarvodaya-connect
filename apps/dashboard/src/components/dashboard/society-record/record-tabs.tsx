"use client";

import { TabLinks } from "../ui/nav-segments";
import { usePathname } from "next/navigation";

import { useI18n } from "@/i18n/provider";

export type RecordTab = { count?: number; href: string; label: string };

/** D05 tab row: Overview, Exco, Work plan, Documents, Grade and History. */
export function RecordTabs({ tabs }: { tabs: RecordTab[] }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <TabLinks
      label={t("sr.tabsLabel")}
      items={tabs.map((tab, index) => ({
        ...tab,
        key: tab.href,
        current: index === 0 ? pathname === tab.href : pathname.startsWith(tab.href),
      }))}
    />
  );
}
