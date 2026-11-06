"use client";

import { primaryButtonClass } from "@/components/dashboard/data-states";
import { useI18n } from "@/i18n/provider";

/** Opens the browser's print dialog, where the report can be saved as PDF. */
export function PrintButton() {
  const { t } = useI18n();
  return (
    <button className={`${primaryButtonClass} print:hidden`} onClick={() => window.print()} type="button">
      {t("n.printSave")}
    </button>
  );
}
