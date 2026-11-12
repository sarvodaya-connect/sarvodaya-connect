import { REGISTRAR_DOCUMENT_TYPES } from "@/lib/v5-constants";

import { ENGLISH } from "@/i18n/english";
import type { MessageKey } from "@/i18n/messages/en";
import type { Translator } from "@/i18n/translate";
import type { RegistrarTotals } from "@/lib/activities-api";

export function percent(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

/** D11 / D12: the four Registrar documents as numbers, in equal-height cards. */
export function RegistrarTotalsCards({ t = ENGLISH, totals }: { t?: Translator; totals: Pick<RegistrarTotals, "activeSocieties" | "byType"> }) {
  const total = totals.activeSocieties;
  return (
    <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {REGISTRAR_DOCUMENT_TYPES.map((type, index) => {
        const entry = totals.byType.find((item) => item.documentType === type);
        return (
          <li className="flex h-full flex-col rounded-lg border border-line bg-surface px-4 py-3" key={type}>
            <span className="text-[12px] font-bold text-ink">{index + 1} · {t(`doc.${type}` as MessageKey)}</span>
            <span className="mt-1 text-[22px] font-bold text-ink">
              {(entry?.submitted ?? 0).toLocaleString("en-GB")}
              <span className="text-[12px] font-normal text-muted"> / {total.toLocaleString("en-GB")}</span>
            </span>
            <span className="text-[11px] text-ink-soft">
              {t("au.notSubmitted", { count: (entry?.missing ?? total).toLocaleString("en-GB") })}
            </span>
            <span className="mt-auto pt-1 text-[10px] text-muted">{t(`au.note.${type}` as MessageKey)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "702 of 1,076 societies have all four · 65%" */
export function allFourLabel(totals: Pick<RegistrarTotals, "activeSocieties" | "allFour">, t: Translator = ENGLISH) {
  return t("au.allFourLabel", {
    count: totals.allFour.toLocaleString("en-GB"),
    total: totals.activeSocieties.toLocaleString("en-GB"),
    percent: percent(totals.allFour, totals.activeSocieties),
  });
}
