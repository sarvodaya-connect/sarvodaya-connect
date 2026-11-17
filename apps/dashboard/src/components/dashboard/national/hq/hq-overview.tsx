"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useCallback, useId, useRef, useState } from "react";

import type { NationalIncident, NationalOverview } from "@sarvodaya-connect/api-contracts";

import { Icon, type IconName } from "@/components/dashboard/icon";
import { SocietyPinsMap } from "@/components/dashboard/maps/society-pins-map";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages/en";
import { formatDate } from "@/i18n/translate";
import { sdgIconPath, sdgName } from "@/lib/sdg";

import { count, GRADE_STYLE, lkrShort, share } from "../format";
import { useMembershipLabels } from "../membership-labels";
import { SampleBadge } from "../parts";
import { Columns, Donut, Ring } from "./charts";
import { PeriodSwitch, ViewToggle } from "./controls";
import { DistrictPanel } from "./district-panel";
import styles from "./hq.module.css";

const UNGRADED = "#c3cbc0";
const FEMALE = "#8a55a8";
const MALE = "#3f68a8";

/** The entry order of a card: at most six short steps, so nothing waits. */
const enter = (index: number) => ({ className: styles.enter, style: { "--i": index } as CSSProperties });

// ---------------------------------------------------------------------------
// Building blocks

function Card({
  action,
  children,
  className = "",
  eyebrow,
  index,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  index: number;
  title: string;
}) {
  // From React, not the text: Sinhala and Tamil titles have no ASCII letters.
  const id = `hq-${useId()}`;
  const { className: enterClass, style } = enter(index);
  return (
    <section aria-labelledby={id} className={`${styles.card} ${enterClass} flex min-w-0 flex-col p-5 ${className}`} style={style}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          {eyebrow && <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-leaf">{eyebrow}</p>}
          <h2 className="break-words text-[15px] font-bold leading-snug text-ink" id={id}>{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className={`${styles.focusRing} group inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-brand-forest hover:bg-brand-mint-soft`}
      href={href}
    >
      {label}
      <Icon className={`${styles.chevron} size-3.5 group-hover:translate-x-0.5`} name="chevron" />
    </Link>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-auto pt-4 text-[11px] leading-relaxed text-muted">{children}</p>;
}

function EmptyState({ icon = "inbox", children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-muted px-4 py-7 text-center">
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-state-mint text-brand-forest">
        <Icon className="size-4" name={icon} />
      </span>
      <p className="max-w-[34ch] text-[12px] text-ink-body">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key figures

type Tone = "green" | "gold" | "plum" | "red" | "slate";
const TONE: Record<Tone, string> = {
  green: "bg-[#e3eee2] text-brand-forest",
  gold: "bg-[#fbf0d2] text-[#7a5a00]",
  plum: "bg-[#f1e8f6] text-[#6c3c88]",
  red: "bg-[#fbe4e1] text-[#a8312a]",
  slate: "bg-[#e7edf4] text-[#2f557c]",
};

function KeyFigure({
  className = "",
  context,
  href,
  icon,
  index,
  label,
  tone,
  value,
  visual,
}: {
  className?: string;
  context: ReactNode;
  href: string;
  icon: IconName;
  index: number;
  label: string;
  tone: Tone;
  value: string;
  visual?: ReactNode;
}) {
  const { className: enterClass, style } = enter(index);
  return (
    <li className={`${enterClass} min-w-0 ${className}`} style={style}>
      <Link className={`${styles.card} ${styles.lift} ${styles.focusRing} group flex h-full flex-col gap-3 p-4`} href={href}>
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 break-words text-[12px] font-semibold text-ink-soft">{label}</span>
          <Icon aria-hidden className={`${styles.chevron} mt-0.5 size-4 shrink-0 text-muted`} name="chevron" />
        </span>
        <span className="flex items-end justify-between gap-3">
          <span className="min-w-0">
            <strong className="block text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">{value}</strong>
            <span className="mt-2 block break-words text-[11px] leading-snug text-muted">{context}</span>
          </span>
          {visual ?? (
            <span aria-hidden="true" className={`hidden size-10 shrink-0 place-items-center rounded-xl sm:grid ${TONE[tone]}`}>
              <Icon className="size-[18px]" name={icon} strokeWidth={2} />
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function KeyFigures({ overview }: { overview: NationalOverview }) {
  const { t } = useI18n();
  const { societies, membership, activities, registrarDocuments: docs, financialYear, incidents } = overview;
  const audit = docs.byType.find((row) => row.documentType === "AUDIT_REPORT");
  const live = incidents.filter((incident) => incident.status === "ACTIVE");
  const notAssessed = live.reduce((sum, incident) => sum + Math.max(0, incident.societiesInArea - incident.assessed), 0);
  return (
    <ul aria-label={t("hq.keyFigures")} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KeyFigure
        context={t("hq.kpi.ofRegistered", { registered: count(societies.registered), percent: share(societies.active, societies.registered) })}
        href="/societies"
        icon="society"
        index={0}
        label={t("hq.kpi.activeSocieties")}
        tone="green"
        value={count(societies.active)}
      />
      <KeyFigure
        context={
          membership.year === null
            ? t("hq.kpi.membersNone")
            : t("hq.kpi.membersYear", { year: membership.year, reported: count(membership.societiesReported), active: count(societies.active) })
        }
        href="/membership"
        icon="people"
        index={1}
        label={t("n.totalMembership")}
        tone="plum"
        value={membership.year === null ? "—" : count(membership.total)}
      />
      <KeyFigure
        context={
          activities.planned === 0
            ? t("hq.kpi.activitiesNone", { year: financialYear.label })
            : t("hq.kpi.activitiesOf", { planned: count(activities.planned), percent: share(activities.completed, activities.planned), year: financialYear.label })
        }
        href={`/activities?year=${financialYear.startYear}`}
        icon="check"
        index={2}
        label={t("n.completedActivities")}
        tone="gold"
        value={count(activities.completed)}
      />
      <KeyFigure
        context={
          audit
            ? t("hq.kpi.auditOf", { active: count(docs.activeSocieties), missing: count(audit.missing), year: financialYear.label })
            : t("hq.kpi.auditNone")
        }
        href={`/compliance?year=${financialYear.startYear}`}
        icon="document"
        index={3}
        label={t("hq.kpi.auditReports")}
        tone="slate"
        value={audit ? count(audit.submitted) : "—"}
        visual={
          audit && docs.activeSocieties > 0 ? (
            <Ring size={44} thickness={5} value={share(audit.submitted, docs.activeSocieties)}>
              <span className="text-[10.5px] font-bold text-ink">{share(audit.submitted, docs.activeSocieties)}%</span>
            </Ring>
          ) : undefined
        }
      />
      <KeyFigure
        className="col-span-2 md:col-span-1"
        context={
          live.length === 0
            ? t("hq.kpi.incidentsNone")
            : notAssessed === 0
              ? t("hq.kpi.allAssessed")
              : t.plural("hq.kpi.incidentsNotAssessed", notAssessed, { count: count(notAssessed) })
        }
        href="/emergencies"
        icon="alert"
        index={4}
        label={t("hq.kpi.liveIncidents")}
        tone={live.length > 0 ? "red" : "green"}
        value={count(live.length)}
      />
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Needs attention: what HQ can act on today, each with where to act.

type Attention = { key: string; count: number; label: string; href: string; icon: IconName; tone: "danger" | "warn" | "neutral"; tag?: string };

function NeedsAttention({ className, index, overview }: { className?: string; index: number; overview: NationalOverview }) {
  const { t } = useI18n();
  const { societies, finance, registrarDocuments: docs, financialYear, incidents } = overview;
  const audit = docs.byType.find((row) => row.documentType === "AUDIT_REPORT");
  const notAssessed = incidents
    .filter((incident) => incident.status === "ACTIVE")
    .reduce((sum, incident) => sum + Math.max(0, incident.societiesInArea - incident.assessed), 0);
  const items: Attention[] = [
    { key: "assess", count: notAssessed, label: t("hq.att.notAssessed"), href: "/emergencies", icon: "alert", tone: "danger" },
    { key: "grades", count: societies.gradeRequestsWaiting, label: t("hq.att.gradeRequests"), href: "/reviews", icon: "review", tone: "warn" },
    {
      key: "audit",
      count: audit?.missing ?? 0,
      label: t("hq.att.auditMissing", { year: financialYear.label }),
      href: `/compliance?year=${financialYear.startYear}`,
      icon: "document",
      tone: docs.pastDue ? "danger" : "warn",
      tag: docs.pastDue ? t("hq.pastDue") : undefined,
    },
    { key: "figures", count: finance.notSubmitted, label: t("hq.att.figuresMissing", { year: financialYear.label }), href: "/societies?view=figures-not-added", icon: "clipboard", tone: "warn" },
    { key: "stale", count: societies.notUpdatedIn90Days, label: t("n.notUpdated90"), href: "/societies?view=not-updated", icon: "clock", tone: "neutral" },
    { key: "ungraded", count: societies.grades.ungraded, label: t("hq.att.ungraded"), href: "/societies", icon: "flag", tone: "neutral" },
    { key: "position", count: societies.withoutLocation, label: t("n.noMapPosition"), href: "/reports?type=data-quality", icon: "map", tone: "neutral" },
  ].filter((item): item is Attention => item.count > 0);
  // The lines overlap (one society can be missing both its audit and its
  // figures) and count different things, so the badge counts lines, not a sum.
  const toneClass = { danger: "bg-[#fbe4e1] text-[#a8312a]", warn: "bg-[#fbf0d2] text-[#7a5a00]", neutral: "bg-[#eceee9] text-ink-soft" } as const;
  return (
    <Card
      action={items.length > 0 ? <span className="rounded-full bg-brand-forest px-2.5 py-1 text-[11px] font-bold text-white">{t.plural("hq.att.lists", items.length, { count: count(items.length) })}</span> : undefined}
      className={className}
      eyebrow={t("hq.att.eyebrow")}
      index={index}
      title={t("hq.att.title")}
    >
      {items.length === 0 ? (
        <EmptyState icon="success">{t("hq.att.allClear")}</EmptyState>
      ) : (
        <ul className="-mx-2 space-y-1">
          {items.map((item) => (
            <li key={item.key}>
              <Link className={`${styles.lift} ${styles.focusRing} group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 hover:bg-brand-mint-soft`} href={item.href}>
                <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-lg ${toneClass[item.tone]}`}>
                  <Icon className="size-4" name={item.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[12.5px] font-semibold leading-snug text-ink">{item.label}</span>
                  {item.tag && <span className="mt-0.5 inline-block rounded bg-[#fbe4e1] px-1.5 py-px text-[10px] font-bold text-[#a8312a]">{item.tag}</span>}
                </span>
                <strong className="text-[16px] text-ink">{count(item.count)}</strong>
                <Icon aria-hidden className={`${styles.chevron} size-4 shrink-0 text-muted`} name="chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Note>{t("hq.att.note")}</Note>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Society status

function SocietyStatus({ index, overview }: { index: number; overview: NationalOverview }) {
  const { t } = useI18n();
  const { societies } = overview;
  const [highlight, setHighlight] = useState<string | null>(null);
  const rows = [
    { key: "A", label: t("n.gradeLabel", { label: t("grade.A") }), note: t("n.noteA"), value: societies.grades.A, colour: GRADE_STYLE.A.colour },
    { key: "B", label: t("n.gradeLabel", { label: t("grade.B") }), note: t("n.noteB"), value: societies.grades.B, colour: GRADE_STYLE.B.colour },
    { key: "C", label: t("n.gradeLabel", { label: t("grade.C") }), note: t("n.noteC"), value: societies.grades.C, colour: GRADE_STYLE.C.colour },
    { key: "U", label: t("hq.notGraded"), note: t("hq.notGradedNote"), value: societies.grades.ungraded, colour: UNGRADED },
  ];
  const summary = rows.map((row) => `${row.label}: ${count(row.value)}`).join(", ");
  return (
    <Card action={<CardLink href="/districts" label={t("nav.districtView")} />} eyebrow={t("n.latestStatus")} index={index} title={t("n.byGradeToday")}>
      <div className="flex flex-wrap items-center gap-5">
        <Donut
          centre={
            <span>
              <strong className="block text-[26px] font-bold leading-none text-brand-forest">{count(societies.active)}</strong>
              <span className="mt-1 block text-[10.5px] text-muted">{t("n.currentlyActive")}</span>
            </span>
          }
          highlight={highlight}
          label={t("hq.gradeChart", { summary })}
          segments={rows.map((row) => ({ key: row.key, value: row.value, colour: row.colour }))}
        />
        <ul className="min-w-[200px] flex-1 space-y-0.5">
          {rows
            .filter((row) => row.key !== "U" || row.value > 0)
            .map((row) => (
              <li
                className="flex cursor-default items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-muted"
                key={row.key}
                onBlur={() => setHighlight(null)}
                onFocus={() => setHighlight(row.key)}
                onMouseEnter={() => setHighlight(row.key)}
                onMouseLeave={() => setHighlight(null)}
                tabIndex={0}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.colour }} />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold text-ink">{row.label}</span>
                    <span className="block break-words text-[10.5px] text-muted">{row.note}</span>
                  </span>
                </span>
                <strong className="text-[16px] text-ink">{count(row.value)}</strong>
              </li>
            ))}
        </ul>
      </div>
      <p className="mt-4 rounded-xl bg-surface-muted px-3 py-2.5 text-[11.5px] leading-relaxed text-ink">
        {t.rich("n.statusLine", {
          registered: <strong>{count(societies.registered)}</strong>,
          active: <strong>{count(societies.active)}</strong>,
          percent: share(societies.active, societies.registered),
          notActive: <strong>{count(societies.registeredNotActive)}</strong>,
        })}
      </p>
      <Note>
        {t("n.gradesHqOnly")}{" "}
        <Link className="font-semibold text-brand-forest underline underline-offset-2" href="/reviews">
          {t.plural("n.gradeRequestsWaiting", societies.gradeRequestsWaiting)}
        </Link>
      </Note>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Map

function SocietyMapCard({ index, onOpenDistricts, overview }: { index: number; onOpenDistricts: (trigger: HTMLButtonElement) => void; overview: NationalOverview }) {
  const { t } = useI18n();
  return (
    <Card action={<CardLink href="/map" label={t("nav.mapView")} />} eyebrow={t("n.societyMap")} index={index} title={t("n.societiesByGrade")}>
      <SocietyPinsMap />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          aria-haspopup="dialog"
          className={`${styles.focusRing} ${styles.lift} inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:border-[#cbd8c8]`}
          onClick={(event) => onOpenDistricts(event.currentTarget)}
          type="button"
        >
          <Icon className="size-3.5 text-brand-leaf" name="district" />
          {t("hq.districtBreakdown", { count: count(overview.districts.length) })}
        </button>
        <Link className={`${styles.focusRing} rounded px-1 text-[11.5px] font-semibold text-brand-forest underline-offset-2 hover:underline`} href="/societies">
          {t("n.listView")}
        </Link>
      </div>
      {overview.societies.withoutLocation > 0 && (
        <Link className={`${styles.focusRing} mt-3 flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-[11px] text-ink hover:bg-brand-mint-soft`} href="/reports?type=data-quality">
          <span>{t.rich("n.noPositionLine", { societies: <strong>{t("n.activeSocietiesCount", { count: count(overview.societies.withoutLocation) })}</strong> })}</span>
          <span className="font-semibold text-brand-forest">{t("n.viewListArrow")}</span>
        </Link>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Membership

function MembershipTable({ overview }: { overview: NationalOverview }) {
  const { t } = useI18n();
  const { label } = useMembershipLabels();
  const { membership } = overview;
  return (
    <table className="w-full text-left text-[11.5px]">
      <caption className="sr-only">{t("n.membershipCategories")}</caption>
      <thead className="text-[10.5px] text-muted">
        <tr>
          <th className="py-1.5 font-semibold" scope="col">{t("n.category")}</th>
          <th className="py-1.5 text-right font-semibold" scope="col">{t("n.female")}</th>
          <th className="py-1.5 text-right font-semibold" scope="col">{t("n.male")}</th>
          <th className="py-1.5 text-right font-semibold" scope="col">{t("n.total")}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft">
        {membership.categories.map((row) => (
          <tr key={row.category}>
            <th className="py-1.5 font-semibold text-ink" scope="row">{label(row.category)}</th>
            <td className="py-1.5 text-right text-[#6c3c88]">{count(row.female)}</td>
            <td className="py-1.5 text-right text-[#2f557c]">{count(row.male)}</td>
            <td className="py-1.5 text-right font-semibold text-ink">{count(row.total)}</td>
          </tr>
        ))}
        <tr className="font-bold">
          <th className="py-1.5 text-ink" scope="row">{t("n.allMembers")}</th>
          <td className="py-1.5 text-right text-[#6c3c88]">{count(membership.female)}</td>
          <td className="py-1.5 text-right text-[#2f557c]">{count(membership.male)}</td>
          <td className="py-1.5 text-right text-ink">{count(membership.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Membership({ index, overview }: { index: number; overview: NationalOverview }) {
  const { t } = useI18n();
  const { label, note } = useMembershipLabels();
  const { membership } = overview;
  const [view, setView] = useState<"categories" | "split">("categories");
  const [table, setTable] = useState(false);
  const tableId = useId();
  const series = [
    { key: "female", label: t("n.female"), colour: FEMALE },
    { key: "male", label: t("n.male"), colour: MALE },
  ];
  return (
    <Card
      action={
        membership.year !== null ? (
          <ViewToggle
            label={t("hq.membershipView")}
            onChange={setView}
            options={[
              { value: "categories", label: t("hq.byCategory") },
              { value: "split", label: t("n.femaleMale") },
            ]}
            value={view}
          />
        ) : undefined
      }
      className="xl:col-span-7"
      eyebrow={t("n.totalMembership")}
      index={index}
      title={membership.year === null ? t("n.femaleMale") : t("hq.membersIn", { year: membership.year })}
    >
      {membership.year === null ? (
        <EmptyState icon="people">{t("hq.membershipNone")}</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p>
              <strong className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">{count(membership.total)}</strong>
              <span className="ml-2 text-[11.5px] text-muted">{t("n.membersInActive", { count: count(membership.societiesReported) })}</span>
            </p>
            <ul aria-hidden="true" className="flex gap-4 text-[11px] text-ink-soft">
              {series.map((s) => (
                <li className="flex items-center gap-1.5" key={s.key}>
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.colour }} />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${styles.viewIn} mt-5`} key={view}>
            {view === "categories" ? (
              <Columns
                groups={membership.categories.map((row) => ({
                  key: row.category,
                  label: label(row.category),
                  values: { female: row.female, male: row.male },
                  description: t("hq.categoryFigures", { category: label(row.category), female: count(row.female), male: count(row.male), total: count(row.total) }),
                }))}
                series={series}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-6">
                <Donut
                  centre={<span className="text-[11px] font-semibold text-muted">{t("n.total")}</span>}
                  label={t("hq.splitChart", { female: count(membership.female), male: count(membership.male) })}
                  segments={[
                    { key: "female", value: membership.female, colour: FEMALE },
                    { key: "male", value: membership.male, colour: MALE },
                  ]}
                  size={132}
                  thickness={18}
                />
                <ul className="grid flex-1 grid-cols-2 gap-3">
                  {[
                    { key: "female", label: t("n.female"), value: membership.female, colour: "text-[#6c3c88]", bg: "bg-[#f6eff9]" },
                    { key: "male", label: t("n.male"), value: membership.male, colour: "text-[#2f557c]", bg: "bg-[#eef2f9]" },
                  ].map((row) => (
                    <li className={`rounded-xl ${row.bg} px-4 py-3`} key={row.key}>
                      <span className="block text-[11px] font-semibold text-ink-soft">{row.label}</span>
                      <strong className={`block text-[22px] font-bold leading-tight ${row.colour}`}>{count(row.value)}</strong>
                      <span className="text-[11px] text-muted">{t("hq.shareOfMembers", { percent: share(row.value, membership.total) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-line-soft pt-3">
            <button
              aria-controls={tableId}
              aria-expanded={table}
              className={`${styles.focusRing} inline-flex items-center gap-1 rounded text-[11.5px] font-semibold text-brand-forest`}
              onClick={() => setTable((open) => !open)}
              type="button"
            >
              <Icon className={`size-3.5 transition-transform duration-200 ${table ? "rotate-90" : ""}`} name="chevron" />
              {table ? t("hq.hideTable") : t("hq.showTable")}
            </button>
            <div className={styles.disclosure} data-open={table} id={tableId}>
              <div inert={!table}>
                <div className="pt-2">
                  <MembershipTable overview={overview} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <Note>{note(membership.year, membership.societiesReported, overview.societies.active)}</Note>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Programmes: completed activities, dimensions and SDGs

function Programmes({ index, overview }: { index: number; overview: NationalOverview }) {
  const { t } = useI18n();
  const { activities, financialYear } = overview;
  return (
    <Card
      action={<CardLink href={`/activities?year=${financialYear.startYear}`} label={t("n.all17")} />}
      className="xl:col-span-5"
      eyebrow={t("n.sdgsDimensions")}
      index={index}
      title={t("n.completedActivities")}
    >
      <p>
        <strong className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">{count(activities.completed)}</strong>
      </p>
      <p className="mt-1 text-[11.5px] text-muted">
        {activities.planned === 0
          ? t("hq.kpi.activitiesNone", { year: financialYear.label })
          : t("n.plannedLine", { planned: count(activities.planned), percent: share(activities.completed, activities.planned), year: financialYear.label })}
      </p>
      <ul className="mt-4 grid grid-cols-3 gap-2">
        {activities.byDimension.map((row) => (
          <li className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-line-soft bg-surface-muted px-2 py-3 text-center" key={row.dimension}>
            <Ring colour="var(--brand-leaf)" size={56} thickness={6} value={row.planned === 0 ? null : share(row.completed, row.planned)}>
              <span className="text-[11px] font-bold text-ink">{row.planned === 0 ? "—" : `${share(row.completed, row.planned)}%`}</span>
            </Ring>
            <span className="min-w-0">
              <span className="block break-words text-[11.5px] font-semibold text-ink">{t(`dimension.${row.dimension}` as MessageKey)}</span>
              <span className="block text-[10.5px] text-muted">
                {row.planned === 0 ? t("hq.nonePlanned") : t("n.ofPlanned", { completed: count(row.completed), planned: count(row.planned) })}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-baseline justify-between gap-2 text-[12px] font-bold text-ink">
        {t("n.sdgsRanked")} <span className="shrink-0 text-[10.5px] font-normal text-muted">{t("n.topOf17", { count: activities.topSdgs.length })}</span>
      </p>
      {activities.topSdgs.length === 0 ? (
        <div className="mt-2 flex flex-1 flex-col">
          <EmptyState icon="chart">{t("n.noSdgYet", { year: financialYear.label })}</EmptyState>
        </div>
      ) : (
        <ol className="mt-2 divide-y divide-line-soft">
          {activities.topSdgs.map((row, rank) => (
            <li className="flex items-center gap-3 py-2" key={row.sdg}>
              <span className="w-5 text-right text-[11px] font-semibold text-muted">#{rank + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- static official icon */}
              <img alt="" className="size-9 shrink-0 rounded-md" src={sdgIconPath(row.sdg)} />
              <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-ink">
                <strong>SDG {row.sdg}</strong> · {sdgName(row.sdg)}
              </span>
              <span className="text-right">
                <strong className="block text-[15px] text-ink">{count(row.completed)}</strong>
                <span className="block text-[10px] text-muted">{t("n.completed")}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <Note>{t("n.sdgExplain")}</Note>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Finance and Registrar documents

function Finance({ demo, index, overview }: { demo: boolean; index: number; overview: NationalOverview }) {
  const { t } = useI18n();
  const { finance, financialYear } = overview;
  // The API adds up each column on its own and sends "0" when nothing is
  // entered. A total is missing only when it is 0 and no society has entered
  // both figures; a society may have entered just one, which still counts.
  const shown = (total: string) => (finance.societiesWithBoth === 0 && Number(total) === 0 ? t("hq.notAddedYet") : lkrShort(total));
  const totals = [
    { key: "profit", label: t("n.totalProfit"), value: shown(finance.totalProfit), tone: "bg-[#eef6ef] text-brand-forest" },
    { key: "expenses", label: t("n.totalExpenses"), value: shown(finance.totalExpenses), tone: "bg-[#fdf3ea] text-[#9a4f12]" },
  ];
  return (
    <Card
      action={<SampleBadge demo={demo} label={t("n.sampleFigures")} />}
      className="xl:col-span-5"
      eyebrow={t("n.profitExpenses")}
      index={index}
      title={t("n.totalsYear")}
    >
      <p className="text-[11.5px] text-muted">{t("n.totalsLine", { year: financialYear.label })}</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {totals.map((row) => (
          <li className={`rounded-xl px-4 py-3 ${row.tone}`} key={row.key}>
            <span className="block text-[11px] font-semibold text-ink-soft">{row.label}</span>
            <strong className="mt-0.5 block break-words text-[20px] font-bold leading-tight">{row.value}</strong>
            <span className="text-[10.5px] text-ink-soft">{t("n.fromActive", { count: count(finance.societiesWithBoth) })}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line-soft px-3 py-3">
        <Ring size={52} thickness={6} value={finance.activeSocieties === 0 ? null : share(finance.societiesWithBoth, finance.activeSocieties)}>
          <span className="text-[10.5px] font-bold text-ink">{share(finance.societiesWithBoth, finance.activeSocieties)}%</span>
        </Ring>
        <p className="min-w-0 text-[11.5px] leading-snug text-ink">
          <strong className="text-[14px]">{count(finance.societiesWithBoth)}</strong>{" "}
          {t("n.submittedBoth", { count: count(finance.activeSocieties), percent: share(finance.societiesWithBoth, finance.activeSocieties) })}
          {finance.notSubmitted > 0 && (
            <>
              <br />
              <span className="text-muted">
                {count(finance.notSubmitted)} {t("n.notSubmittedYet")}{" "}
                <Link className="font-semibold text-brand-forest underline underline-offset-2" href="/societies?view=figures-not-added">{t("n.viewList")}</Link>
              </span>
            </>
          )}
        </p>
      </div>
      <p className="mt-auto flex gap-2 pt-4 text-[11px] leading-relaxed text-muted">
        <Icon className="mt-0.5 size-3.5 shrink-0" name="help" />
        {t("n.onlyTwoTotals")}
      </p>
    </Card>
  );
}

function Documents({ index, overview }: { index: number; overview: NationalOverview }) {
  const { locale, t } = useI18n();
  const { registrarDocuments: docs, financialYear } = overview;
  const audit = docs.byType.find((row) => row.documentType === "AUDIT_REPORT");
  const percent = audit ? share(audit.submitted, docs.activeSocieties) : 0;
  const due = formatDate(locale, new Date(`${docs.auditReportDueOn}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (
    <Card
      action={<CardLink href={`/compliance?year=${financialYear.startYear}`} label={t("nav.audits")} />}
      className="xl:col-span-7"
      eyebrow={t("n.auditAgm")}
      index={index}
      title={t("n.docsRegistrar")}
    >
      <div className="flex flex-wrap items-center gap-4">
        <Ring size={76} thickness={8} value={docs.activeSocieties === 0 ? null : percent}>
          <span className="text-[16px] font-bold text-ink">{percent}%</span>
        </Ring>
        <div className="min-w-[200px] flex-1 text-[12px] leading-relaxed text-ink">
          {audit && (
            <p>{t.rich("n.auditLine", { count: <strong>{t("n.xOfY", { x: count(audit.submitted), y: count(docs.activeSocieties) })}</strong>, year: financialYear.label })}</p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-2">
            {audit && <span className="font-semibold text-[#a8312a]">{t("n.missingCount", { count: count(audit.missing) })}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${docs.pastDue ? "bg-[#fbe4e1] text-[#a8312a]" : "bg-[#e5f3e8] text-[#25643f]"}`}>
              {docs.pastDue ? t("hq.pastDueOn", { date: due }) : t("hq.dueOnDate", { date: due })}
            </span>
          </p>
        </div>
      </div>
      <table className="mt-4 w-full text-left text-[11.5px]">
        <thead className="text-[10.5px] text-muted">
          <tr>
            <th className="py-1.5 font-semibold" scope="col">{t("n.documentYear", { year: financialYear.label })}</th>
            <th className="py-1.5 text-right font-semibold" scope="col">{t("n.submitted")}</th>
            <th className="py-1.5 text-right font-semibold" scope="col">{t("n.missing")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {docs.byType.map((row) => (
            <tr className="transition-colors hover:bg-surface-muted" key={row.documentType}>
              <th className="py-2 font-normal text-ink" scope="row">{t(`doc.${row.documentType}` as MessageKey)}</th>
              <td className="py-2 text-right font-semibold text-brand-forest">{count(row.submitted)}</td>
              <td className="py-2 text-right font-semibold text-[#a8312a]">{count(row.missing)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <th className="py-2 text-ink" scope="row">{t("n.allFour")}</th>
            <td className="py-2 text-right text-brand-forest">{count(docs.allFour)}</td>
            <td className="py-2 text-right text-[#a8312a]">{count(Math.max(0, docs.activeSocieties - docs.allFour))}</td>
          </tr>
        </tbody>
      </table>
      <Note>{t("n.outOf", { count: count(docs.activeSocieties) })}</Note>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Incidents

function IncidentRow({ defaultOpen, incident }: { defaultOpen: boolean; incident: NationalIncident }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const detailId = useId();
  const active = incident.status === "ACTIVE";
  const notAssessed = Math.max(0, incident.societiesInArea - incident.assessed);
  const figures = [
    { label: t("n.inArea"), value: count(incident.societiesInArea) },
    { label: t("n.assessed"), value: count(incident.assessed) },
    { label: t("n.notAssessed"), value: count(notAssessed), danger: notAssessed > 0 },
    { label: t("n.familiesPeople", { count: count(incident.peopleAffected) }), value: count(incident.householdsAffected) },
    { label: t("n.actionsDelivered", { count: count(incident.actionsCompleted) }), value: count(incident.actions) },
  ];
  return (
    <li className={`rounded-xl border ${active ? "border-[#f0cfcb] bg-[#fdf6f5]" : "border-line bg-surface"}`}>
      <button
        aria-controls={detailId}
        aria-expanded={open}
        className={`${styles.focusRing} flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-left`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Icon className={`size-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`} name="chevron" />
        {active && <span className="rounded bg-[#a8312a] px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">{t("n.live")}</span>}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[13px] font-bold text-ink">{incident.title}</span>
          <span className="block text-[11px] text-ink-soft">
            {t("n.incidentMeta", {
              district: incident.districtName,
              date: formatDate(locale, new Date(incident.activatedAt), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Colombo" }),
              severity: t(`severity.${incident.severity}` as MessageKey),
            })}
          </span>
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${active ? "bg-[#fbe4e1] text-[#a8312a]" : "bg-[#e5f3e8] text-[#25643f]"}`}>
          {active ? t("n.responding") : t("n.contained")}
        </span>
      </button>
      <div className={styles.disclosure} data-open={open} id={detailId}>
        <div inert={!open}>
          <div className="px-4 pb-4">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {figures.map((figure) => (
                <li className="rounded-lg border border-line-soft bg-surface px-3 py-2" key={figure.label}>
                  <strong className={`block text-[18px] font-bold leading-tight ${figure.danger ? "text-[#a8312a]" : "text-ink"}`}>{figure.value}</strong>
                  <span className="block break-words text-[10.5px] text-ink-soft">{figure.label}</span>
                </li>
              ))}
            </ul>
            <Link
              className={`${styles.focusRing} ${styles.lift} mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-forest px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#174f34]`}
              href="/emergencies"
            >
              {t("n.openIncident")} <Icon className="size-3.5" name="chevron" />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function Incidents({ index, overview }: { index: number; overview: NationalOverview }) {
  const { t } = useI18n();
  const { incidents } = overview;
  const firstLive = incidents.findIndex((incident) => incident.status === "ACTIVE");
  return (
    <Card
      action={<CardLink href="/emergencies" label={t("nav.disasterResponse")} />}
      className="xl:col-span-12"
      eyebrow={t("nav.disasterEmergency")}
      index={index}
      title={t("n.activeIncidents")}
    >
      {incidents.length === 0 ? (
        <EmptyState icon="success">{t("n.noIncidents")}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {incidents.map((incident, position) => (
            <IncidentRow defaultOpen={position === firstLive} incident={incident} key={incident.id} />
          ))}
        </ul>
      )}
      <Note>{t("n.everyRole")}</Note>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page

function AskSarvoAi() {
  const { t } = useI18n();
  const [askBefore, askAfter] = t("shell.ask").split("{brand}");
  return (
    <form action="/sarvoai" className={`${styles.card} flex flex-wrap items-center gap-3 px-3 py-2.5`} method="get" role="search">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-forest text-[#f3c44e]">
        <Icon className="size-4" name="sparkle" />
      </span>
      <span className="min-w-[150px]">
        <strong className="block text-[12.5px] text-ink">
          {askBefore}Sarvo<span className="text-[#d98a22]">AI</span>
          {askAfter}
        </strong>
        <span className="text-[10.5px] text-muted">{t("n.hqOnlyAnswers")}</span>
      </span>
      <label className="sr-only" htmlFor="ask-sarvoai">{t("n.askQuestion")}</label>
      <input
        className="min-w-[200px] flex-1 rounded-[10px] border border-line bg-surface-muted px-3 py-2 text-[12px] text-ink outline-none transition-[border-color,box-shadow] focus:border-brand-leaf focus:ring-2 focus:ring-[var(--brand-mint-ring)]"
        id="ask-sarvoai"
        maxLength={500}
        minLength={3}
        name="q"
        placeholder={t("n.askPlaceholder")}
        required
      />
      <button className={`${styles.focusRing} ${styles.lift} rounded-[10px] bg-brand-forest px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#174f34]`} type="submit">
        {t("n.ask")}
      </button>
    </form>
  );
}

/**
 * The redesigned HQ National Overview (V5 D02). Same API figures and links as
 * before; the reporting period, units and coverage stay written next to each
 * figure, and a missing figure is never shown as zero.
 */
export function HqOverview({ demo, overview, years }: { demo: boolean; overview: NationalOverview; years: number[] }) {
  const { locale, t } = useI18n();
  const { financialYear } = overview;
  const [pending, setPending] = useState(false);
  const [districtsOpen, setDistrictsOpen] = useState(false);
  const districtTrigger = useRef<HTMLButtonElement | null>(null);
  const onPendingChange = useCallback((value: boolean) => setPending(value), []);
  const period = (date: string) => formatDate(locale, new Date(`${date}T00:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div aria-busy={pending} className={`${styles.root} space-y-4`} data-pending={pending}>
      <div className={styles.enter} style={{ "--i": 0 } as CSSProperties}>
        <h1 className="break-words text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">{t("nav.nationalOverview")}</h1>
        <p className="mt-1 break-words text-[12.5px] text-ink-soft">{t("sub.national")}</p>
      </div>
      <div className={`${styles.enter} flex flex-wrap items-center justify-between gap-x-4 gap-y-3`} style={{ "--i": 0 } as CSSProperties}>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-leaf">{t("n.reportingPeriod")}</p>
          <p className="text-[13px] font-semibold text-ink">
            {financialYear.label}
            <span className="font-normal text-muted"> · {period(financialYear.startsOn)} – {period(financialYear.endsOn)}</span>
          </p>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          {/* The shared pill never wraps; here a long Sinhala or Tamil label may. */}
          <span className="min-w-0 max-w-full [&>span]:whitespace-normal">
            <SampleBadge demo={demo} label={t("n.demoSample")} />
          </span>
          <PeriodSwitch current={financialYear.startYear} onPendingChange={onPendingChange} years={years} />
        </div>
      </div>

      <div className={styles.content}>
        <div className="space-y-4">
          <KeyFigures overview={overview} />
          <p className="text-[11px] text-muted">{overview.membership.year === null
            ? t("n.periodNote", { year: financialYear.label })
            : t("hq.periodNote", { year: financialYear.label, membershipYear: overview.membership.year })}</p>

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="grid gap-4 md:grid-cols-2 xl:col-span-8">
              <SocietyStatus index={1} overview={overview} />
              <SocietyMapCard
                index={2}
                onOpenDistricts={(trigger) => {
                  districtTrigger.current = trigger;
                  setDistrictsOpen(true);
                }}
                overview={overview}
              />
            </div>
            <div className="flex flex-col xl:col-span-4">
              <NeedsAttention className="flex-1" index={3} overview={overview} />
            </div>
          </div>

          <AskSarvoAi />

          <div className="grid gap-4 xl:grid-cols-12">
            <Membership index={4} overview={overview} />
            <Programmes index={5} overview={overview} />
          </div>
          <div className="grid gap-4 xl:grid-cols-12">
            <Finance demo={demo} index={6} overview={overview} />
            <Documents index={6} overview={overview} />
          </div>
          <div className="grid gap-4 xl:grid-cols-12">
            <Incidents index={6} overview={overview} />
          </div>
        </div>
      </div>

      <DistrictPanel
        districts={overview.districts}
        onClose={() => {
          setDistrictsOpen(false);
          districtTrigger.current?.focus();
        }}
        open={districtsOpen}
      />
    </div>
  );
}
