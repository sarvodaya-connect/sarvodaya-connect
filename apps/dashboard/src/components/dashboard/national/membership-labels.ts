"use client";

import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages/en";

/** Membership categories as the API stores them, with their display names. */
const CATEGORY_KEYS: Record<string, MessageKey> = {
  CHILDREN: "member.CHILDREN",
  YOUTH: "member.YOUTH",
  MOTHERS: "member.MOTHERS",
  ORDINARY: "member.ORDINARY",
  ELDERS_COUNCIL: "member.ELDERS_COUNCIL",
};

export function useMembershipLabels() {
  const { t } = useI18n();
  return {
    label: (category: string) => (CATEGORY_KEYS[category] ? t(CATEGORY_KEYS[category]) : category),
    /** "Counts only, no personal data · 1,018 of 1,076 societies reported for 2026". */
    note: (year: number | null, reported: number, active: number) =>
      year === null
        ? t("member.noteNone")
        : t("member.note", { reported: reported.toLocaleString("en-GB"), active: active.toLocaleString("en-GB"), year, missing: Math.max(0, active - reported).toLocaleString("en-GB") }),
  };
}
