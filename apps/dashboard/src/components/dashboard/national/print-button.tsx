"use client";

import { primaryButtonClass } from "@/components/dashboard/data-states";

/** Opens the browser's print dialog, where the report can be saved as PDF. */
export function PrintButton() {
  return (
    <button className={`${primaryButtonClass} print:hidden`} onClick={() => window.print()} type="button">
      Print or save as PDF
    </button>
  );
}
