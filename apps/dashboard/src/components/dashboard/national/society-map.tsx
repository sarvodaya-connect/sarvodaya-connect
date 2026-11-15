"use client";

import type { SocietyMap } from "@sarvodaya-connect/api-contracts";

import { SocietyPinsMap } from "@/components/dashboard/maps/society-pins-map";
import { Pill } from "@/components/dashboard/ui/pill";
import { useI18n } from "@/i18n/provider";
import { GRADE_COLOURS } from "@/lib/map-settings";

/**
 * V5 D03 Map View (issue #181): the societies the filters chose, on a real
 * map of Sri Lanka. Clicking a society opens its record; nearby societies
 * group into bubbles that zoom in. The counts come from the API with the
 * same filters.
 */
export function SocietyMapView({ counts, demo, points, truncated }: { counts: SocietyMap["counts"]; demo: boolean; points: SocietyMap["points"]; truncated: boolean }) {
  const { t } = useI18n();
  const totals = [
    { key: "A", label: t("grade.A"), value: counts.A },
    { key: "B", label: t("grade.B"), value: counts.B },
    { key: "C", label: t("grade.C"), value: counts.C },
    { key: "UNGRADED", label: t("map.activeUngraded"), value: counts.ungraded },
    { key: "NOT_ACTIVE", label: t("map.registeredNotActive"), value: counts.notActive },
  ] as const;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label={t("map.ofSocieties")} className="rounded-card border border-line bg-surface p-4">
        <SocietyPinsMap className="h-[min(640px,70vh)] min-h-[360px]" legend={false} points={points} truncated={truncated} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span>{t("map.dotsNote", { count: counts.withoutLocation.toLocaleString("en-GB") })}</span>
          {demo && <Pill tone="preview">{t("n.demoData")}</Pill>}
        </div>
      </section>
      <section aria-labelledby="on-the-map" className="self-start rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("map.onMap")}</p>
        <h2 className="text-[15px] font-bold text-ink" id="on-the-map">{t("map.activeCount", { count: (counts.A + counts.B + counts.C + counts.ungraded).toLocaleString("en-GB") })}</h2>
        <ul aria-label={t("map.societyClass")} className="mt-2 divide-y divide-line-soft text-[12px]">
          {totals.map((row) => (
            <li className="flex items-center justify-between py-2" key={row.key}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: GRADE_COLOURS[row.key] }} />
                {row.label}
              </span>
              <strong className="text-ink">{row.value.toLocaleString("en-GB")}</strong>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">{t("map.clickToOpen")}</p>
      </section>
    </div>
  );
}
