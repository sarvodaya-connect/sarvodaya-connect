"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { SocietyMap, SocietyAtAGlance } from "@sarvodaya-connect/api-contracts";

import { loadSocietySummary } from "@/app/(dashboard)/map/actions";
import { primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Pill } from "@/components/dashboard/ui/pill";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages/en";
import { localeTag } from "@/i18n/translate";

import { IslandOutline, MAP_HEIGHT, MAP_WIDTH, project } from "./sri-lanka";

const CLASS_COLOURS: Record<SocietyMap["points"][number]["class"], string> = {
  A: "#3f7d4f",
  B: "#e1b84a",
  C: "#de7c3a",
  UNGRADED: "#7c8a99",
  NOT_ACTIVE: "#a3a8a2",
};

const LEGEND: { key: keyof typeof CLASS_COLOURS; label: MessageKey }[] = [
  { key: "A", label: "grade.A" },
  { key: "B", label: "grade.B" },
  { key: "C", label: "grade.C" },
  { key: "UNGRADED", label: "map.activeUngraded" },
  { key: "NOT_ACTIVE", label: "map.notActive" },
];

function Selected({ summary }: { summary: SocietyAtAGlance }) {
  const { locale, t } = useI18n();
  const rows: [string, string][] = [
    [t("map.societyId"), summary.societyCode],
    [t("mb.district"), summary.district],
    [t("map.lastUpdated"), new Date(summary.updatedAt).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" })],
    [t("d.recordsComplete"), `${summary.recordsCompletePercent}%`],
    [t("nav.membersShort"), summary.members === null ? t("map.notEntered") : summary.members.toLocaleString("en-GB")],
  ];
  return (
    <>
      <h2 className="mt-1 text-[17px] font-bold text-ink" id="selected-society">{summary.name}</h2>
      <p className="mt-1 flex flex-wrap gap-1.5">
        <Pill tone={summary.status === "ACTIVE" ? "on-time" : "inactive"}>{summary.status === "ACTIVE" ? t("home.active") : t("map.notActiveLower")}</Pill>
        {summary.grade && <Pill tone="fast-target">{t("map.classOf", { grade: summary.grade })}</Pill>}
      </p>
      <dl className="mt-3 divide-y divide-line-soft text-[12px]">
        {rows.map(([label, value]) => (
          <div className="py-2" key={label}>
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid gap-2">
        <Link className={primaryButtonClass} href={`/societies/${summary.id}`}>{t("map.openRecord")}</Link>
      </div>
    </>
  );
}

/** V5 D03: dots by class; choosing one shows that society's summary. */
export function SocietyMapView({ counts, demo, points }: { counts: SocietyMap["counts"]; demo: boolean; points: SocietyMap["points"] }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SocietyAtAGlance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(id: string) {
    setSelectedId(id);
    setError(null);
    startTransition(async () => {
      const result = await loadSocietySummary(id);
      if ("error" in result) {
        setSummary(null);
        setError(result.error);
      } else setSummary(result);
    });
  }

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
        <div className="relative">
          <svg aria-labelledby="society-map-title" className="mx-auto h-auto max-h-[640px] w-full" role="img" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
            <title id="society-map-title">{t("map.withPosition", { count: points.length.toLocaleString("en-GB") })}</title>
            <IslandOutline />
            {points.map((point) => {
              const { x, y } = project(point.latitude, point.longitude);
              const selected = point.id === selectedId;
              return (
                <circle
                  aria-label={`${point.name}, ${point.societyCode}`}
                  className="cursor-pointer focus:outline-none"
                  cx={x}
                  cy={y}
                  fill={CLASS_COLOURS[point.class]}
                  key={point.id}
                  onClick={() => choose(point.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      choose(point.id);
                    }
                  }}
                  r={selected ? 4.5 : 2.6}
                  role="button"
                  stroke={selected ? "#1d2a22" : "white"}
                  strokeWidth={selected ? 1.6 : 0.6}
                  tabIndex={0}
                />
              );
            })}
          </svg>
          <ul aria-label={t("map.societyClass")} className="absolute right-0 top-0 rounded-lg border border-line bg-surface/95 px-3 py-2 text-[11px]">
            {LEGEND.map((item) => (
              <li className="flex items-center gap-2" key={item.key}>
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: CLASS_COLOURS[item.key] }} />
                {t(item.label)}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span>
            {t("map.dotsNote", { count: counts.withoutLocation.toLocaleString("en-GB") })}
          </span>
          {demo && <Pill tone="preview">{t("n.demoData")}</Pill>}
        </div>
      </section>
      <div className="flex flex-col gap-4">
        <section aria-labelledby="selected-society" aria-live="polite" className="rounded-card border border-line bg-surface p-4">
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("map.selected")}</p>
          {pending ? (
            <p className="mt-3 text-[12px] text-muted" role="status">{t("map.loadingSociety")}</p>
          ) : error ? (
            <p className="mt-3 text-[12px] text-[#a8312a]" role="alert">{error}</p>
          ) : summary ? (
            <Selected summary={summary} />
          ) : (
            <p className="mt-3 text-[12px] text-muted" id="selected-society">{t("map.chooseDot")}</p>
          )}
          {summary && (
            <Link className={`${secondaryButtonClass} mt-2 w-full justify-center`} href={`/societies?districtId=${summary.districtId}`}>
              {t("map.societiesIn", { district: summary.district })}
            </Link>
          )}
        </section>
        <section aria-labelledby="on-the-map" className="rounded-card border border-line bg-surface p-4">
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("map.onMap")}</p>
          <h2 className="text-[15px] font-bold text-ink" id="on-the-map">{t("map.activeCount", { count: (counts.A + counts.B + counts.C + counts.ungraded).toLocaleString("en-GB") })}</h2>
          <ul className="mt-2 divide-y divide-line-soft text-[12px]">
            {totals.map((row) => (
              <li className="flex items-center justify-between py-2" key={row.key}>
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: CLASS_COLOURS[row.key] }} />
                  {row.label}
                </span>
                <strong className="text-ink">{row.value.toLocaleString("en-GB")}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
