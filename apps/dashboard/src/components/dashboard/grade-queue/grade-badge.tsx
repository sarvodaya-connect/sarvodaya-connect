"use client";

import type { SocietyGrade } from "@sarvodaya-connect/api-contracts";

import { useI18n } from "@/i18n/provider";
import { gradeBadgeClass } from "@/lib/society-record-format";

/** Small square grade letter used by the grade queue (V5 D22, D22r). */
export function GradeBadge({ grade, size = "sm" }: { grade: SocietyGrade | null; size?: "sm" | "lg" }) {
  const { t } = useI18n();
  const sizing = size === "lg" ? "size-10 rounded-lg text-[18px]" : "size-[22px] rounded-md text-[11px]";
  return (
    <span
      aria-label={grade ? t("n.gradeOf", { grade }) : t("n.gradeNotSet")}
      className={`inline-grid shrink-0 place-items-center font-bold ${sizing} ${grade ? gradeBadgeClass[grade] : "bg-state-grey text-muted"}`}
    >
      {grade ?? "–"}
    </span>
  );
}

/** "B → A" with grade squares. */
export function GradeChange({ from, to }: { from: SocietyGrade | null; to: SocietyGrade }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5">
      <GradeBadge grade={from} />
      <span aria-hidden="true" className="text-ink-soft">→</span>
      <span className="sr-only">{t("n.to")}</span>
      <GradeBadge grade={to} />
    </span>
  );
}
