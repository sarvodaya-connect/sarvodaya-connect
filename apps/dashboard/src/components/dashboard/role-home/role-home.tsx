import Link from "next/link";
import type { ReactNode } from "react";

import type { HomeAttentionItem, HomeSummary } from "@sarvodaya-connect/api-contracts";

import { actionLabel } from "@/lib/audit-log";
import type { DemoViewer } from "@/lib/access";
import { endDistrictAccess } from "@/app/(dashboard)/district-access/actions";
import { ENGLISH } from "@/i18n/english";
import type { MessageKey } from "@/i18n/messages/en";
import type { Translator } from "@/i18n/translate";
import { accessSentence, endsLabel, gradeLine, greeting, longDate, shortDateTime, shortRole, timeLeft, updatedLabel, waitedLabel } from "@/lib/home-format";

import { EndAccessButton } from "../district-access/access-controls";

import { GradeBadge } from "../grade-queue/grade-badge";
import { Icon, type IconName } from "../icon";
import { Donut, Ring } from "../national/hq/charts";
import { GRADE_STYLE, share } from "../national/format";
import { AccessBanner } from "../ui/access-banner";

import styles from "./role-home.module.css";

/** "today", "yesterday" or "on 02 Oct", to read inside a sentence. */
function sinceLabel(value: string, now: Date, t: Translator) {
  const label = updatedLabel(value, now, t);
  if (label === t("home.today")) return t("home.whenToday");
  if (label === t("home.yesterday")) return t("home.whenYesterday");
  return t("home.whenOn", { date: label });
}

const ROLE_TITLE: Record<HomeSummary["role"], MessageKey> = {
  PROGRAMME_COORDINATOR: "home.roleSpc",
  DEPUTY_DISTRICT_MANAGER: "home.roleDdm",
  DISTRICT_MANAGER: "home.roleDm",
};

type Tone = "ink" | "amber" | "red";
const toneClass: Record<Tone, string> = { ink: "text-ink", amber: "text-[#a07a10]", red: "text-danger-text" };
const iconTone: Record<Tone, string> = { ink: "bg-brand-mint text-brand-forest", amber: "bg-[#fbf0d2] text-[#7a5a00]", red: "bg-[#fbe4e1] text-[#a8312a]" };

/** Entry order of a block: at most six short steps, so nobody waits for the page. */
const order = (index: number) => ({ "--i": index }) as React.CSSProperties;

/**
 * A summary figure: label, big number, one line of detail. Numbers only, never
 * a bar. With `href` the whole tile opens the list behind the figure.
 */
function Tile({ label, value, detail, icon, tone = "ink", href }: { label: string; value: string; detail: ReactNode; icon: IconName; tone?: Tone; href?: string }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-[12px] font-semibold text-ink-soft">{label}</span>
        <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-[10px] ${iconTone[tone]}`}>
          <Icon className="size-4" name={icon} strokeWidth={2} />
        </span>
      </span>
      <strong className={`text-[28px] font-bold leading-none tracking-[-0.02em] ${toneClass[tone]}`}>{value}</strong>
      <span className="truncate text-[11px] text-muted">{detail}</span>
    </>
  );
  return (
    <li className="min-w-0">
      {href ? (
        <Link className={`${styles.tile} ${styles.lift} ${styles.focusRing}`} href={href}>
          {body}
        </Link>
      ) : (
        <div className={styles.tile}>{body}</div>
      )}
    </li>
  );
}

/** Numbered card. Cards in a row stretch to the same height, so no row has gaps. */
function Card({
  n,
  eyebrow,
  title,
  action,
  children,
  id,
  className = "",
}: {
  n: number;
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id: string;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`${styles.card} flex min-w-0 flex-col gap-4 p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-mint text-[10.5px] font-bold text-brand-forest">
            {n}
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-leaf">
              <span className="sr-only">{n} · </span>
              {eyebrow}
            </p>
            <h2 className="break-words text-[15px] font-bold leading-snug text-ink" id={id}>
              {title}
            </h2>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A link styled as a button, for the quick actions beside the greeting. */
function QuickAction({ href, icon, label, primary, danger }: { href: string; icon: IconName; label: string; primary?: boolean; danger?: boolean }) {
  const look = primary
    ? "border-brand-forest bg-brand-forest text-white hover:bg-[#174f34]"
    : danger
      ? "border-[var(--banner-incident-line)] bg-surface text-danger-text hover:bg-danger-bg"
      : "border-button-line bg-surface text-ink hover:bg-brand-mint-soft";
  return (
    <Link className={`${styles.press} ${styles.focusRing} inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border px-3.5 py-1.5 text-[12.5px] font-semibold ${look}`} href={href}>
      <Icon className="size-4 shrink-0" name={icon} strokeWidth={2} />
      <span className="break-words">{label}</span>
    </Link>
  );
}

function AccessPill({ editable, t }: { editable: boolean; t: Translator }) {
  return editable ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success-text">
      <Icon className="size-3" name="check" strokeWidth={2.4} />
      {t("home.editable")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-[#f0f1ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#56615a]">
      <Icon className="size-3" name="lock" strokeWidth={2.2} />
      {t("home.viewOnly")}
    </span>
  );
}

function ViewOnlyChip({ t }: { t: Translator }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-[#f0f1ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#56615a]">
      <Icon className="size-3" name="lock" strokeWidth={2.2} />
      {t("home.viewOnly")}
    </span>
  );
}

export function PendingGradeChip({ pending, t = ENGLISH }: { pending: NonNullable<HomeAttentionItem["pendingGrade"]>; t?: Translator }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-warn-bg px-2 py-0.5 text-[10px] font-semibold text-warn-text">
      <span aria-hidden="true">●</span> {t("home.withHq", { from: pending.from ?? "–", to: pending.to })}
    </span>
  );
}

function AttentionTable({ items, showSpc, t }: { items: HomeAttentionItem[]; showSpc: boolean; t: Translator }) {
  if (!items.length) {
    return (
      <p className={`${styles.settle} flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface-muted px-4 py-5 text-[12.5px] text-ink-soft`}>
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-mint text-brand-forest">
          <Icon className="size-4" name="success" />
        </span>
        {t("home.nothingAttention")}
      </p>
    );
  }
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-muted">
          <tr>
            <th className={th} scope="col">{t("home.society")}</th>
            <th className={th} scope="col">{t("home.grade")}</th>
            <th className={th} scope="col">{t("home.needsAttention")}</th>
            {showSpc && <th className={th} scope="col">{t("s.filterSpc")}</th>}
            <th className={th} scope="col"><span className="sr-only">{t("home.yourAccessHead")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {items.map((item, index) => (
            <tr className="transition-colors hover:bg-surface-muted" key={`${item.societyId}-${index}`}>
              <td className="px-3 py-3 text-[12.5px]">
                <Link className="font-semibold text-brand-forest underline underline-offset-2" href={`/societies/${item.societyId}`}>
                  {item.societyName}
                </Link>
              </td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <GradeBadge grade={item.grade} />
                  {showSpc && item.pendingGrade && <PendingGradeChip pending={item.pendingGrade} t={t} />}
                </span>
              </td>
              <td className="px-3 py-3 text-[12.5px] text-ink">{item.reason}</td>
              {showSpc && <td className="px-3 py-3 text-[12.5px] text-ink">{item.spcName ?? t("home.notAssigned")}</td>}
              <td className="px-3 py-3 text-right">
                <AccessPill editable={item.editable} t={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** V5 SP01 / DD01 / DM01 incident banner, with a working "Open incident" link (PR 8). */
function IncidentBanners({ home, now, t }: { home: HomeSummary; now: Date; t: Translator }) {
  return home.incidents.map((incident) => (
    <AccessBanner
      action={
        <Link className="underline underline-offset-2" href={`/emergencies/${incident.id}`}>
          {t("home.openIncident")}
        </Link>
      }
      key={incident.id}
      tone="incident"
    >
      <strong>{t("home.incidentTitle", { reference: incident.reference, title: incident.title })}</strong>{" "}
      {incident.openedByName
        ? t("home.openedBy", {
            name: `${incident.openedByName}${incident.openedByRole ? ` (${shortRole(incident.openedByRole, t)})` : ""}`,
            when: sinceLabel(incident.openedAt, now, t),
          })
        : t("home.opened", { when: sinceLabel(incident.openedAt, now, t) })}
      {incident.assessmentsDueAt ? t("home.assessmentsDue", { date: endsLabel(incident.assessmentsDueAt, t) }) : ""}.
    </AccessBanner>
  ));
}

/** V5 SP01 / DD01 "3 · Disaster response": open the live incident or report a new one. */
function IncidentsCard({ home, n, t }: { home: HomeSummary; n: number; t: Translator }) {
  const live = home.incidents[0];
  const button = `${styles.press} ${styles.focusRing} inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border px-3.5 py-1.5 text-[12.5px] font-semibold`;
  return (
    <Card eyebrow={t("home.disasterResponse")} id="incidents-heading" n={n} title={t("home.incidents")}>
      <p className="text-[12.5px] text-ink-soft">
        {t("home.incidentsHelp")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link className={`${button} border-button-line text-ink hover:bg-brand-mint-soft`} href={live ? `/emergencies/${live.id}` : "/emergencies"}>
          <Icon className="size-4" name="alert" strokeWidth={2} />
          {t("home.openIncident")}
        </Link>
        <Link className={`${button} border-[var(--banner-incident-line)] text-danger-text hover:bg-danger-bg`} href="/dashboard?report=incident">
          {t("home.reportIncident")}
        </Link>
      </div>
    </Card>
  );
}

/** DM01 card 3: the DM's grants of temporary, view-only district access to a DDM. */
function TemporaryAccessCard({ home, n, now, t }: { home: HomeSummary; n: number; now: Date; t: Translator }) {
  const grant = home.temporaryAccess[0];
  const status = (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${grant ? "bg-info-bg text-info-text" : "bg-[#f0f1ee] text-[#56615a]"}`}>
      <span aria-hidden="true">●</span> {grant ? t("home.active") : t("home.none")}
    </span>
  );
  return (
    <Card action={status} eyebrow={t("home.temporaryAccess")} id="temporary-access-heading" n={n} title={grant ? t("home.activeGrant") : t("home.noGrant")}>
      {grant ? (
        <div className="flex flex-1 flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info-bg text-[11px] font-bold text-info-text">
              {grant.deputyName.split(" ").map((part) => part[0]).slice(0, 2).join("")}
            </span>
            <span className="text-[12px] text-ink-soft">
              <strong className="block text-[13px] text-ink">{grant.deputyName}</strong>
              {t("home.grantLine", { count: grant.districtSocietyCount, date: endsLabel(grant.expiresAt, t), left: timeLeft(grant.expiresAt, now, t) })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-8 items-center rounded-button border border-button-line px-3 text-[12px] font-semibold text-ink hover:bg-brand-mint-soft"
              href={`/district-access?grant=${grant.id}`}
            >
              {t("home.seeDetails")}
            </Link>
            <EndAccessButton action={endDistrictAccess} compact deputyName={grant.deputyName} grantId={grant.id} returnTo="/dashboard" />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-3">
          <p className="text-[12.5px] text-ink-soft">{t("home.noDdmAccess")}</p>
          <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/district-access?panel=give">
            {t("home.giveAccess")}
          </Link>
        </div>
      )}
    </Card>
  );
}

/** V5 DD02 banner: the DDM's district-wide view, with the time left as text. */
export function TemporaryViewBanner({ grant, now, t = ENGLISH }: { grant: HomeSummary["temporaryAccess"][number]; now: Date; t?: Translator }) {
  return (
    <AccessBanner action={t("home.tempBannerAction", { date: endsLabel(grant.expiresAt, t), left: timeLeft(grant.expiresAt, now, t) })} tone="temporary">
      {t.rich("home.tempBanner", {
        title: <strong>{t("home.tempTitle")}</strong>,
        count: grant.districtSocietyCount,
        district: grant.districtName,
        viewOnly: <strong>{t("home.viewOnlyLower")}</strong>,
        by: grant.grantedByName ?? t("home.yourDmLower"),
        date: shortDateTime(grant.grantedAt, t),
      })}
    </AccessBanner>
  );
}

/** V5 DD07: the district-wide view has ended; links to other district societies now show "No access". */
export function AccessEndedBanner({ ended, assigned, t = ENGLISH }: { ended: NonNullable<HomeSummary["recentlyEnded"]>; assigned: number; t?: Translator }) {
  return (
    <AccessBanner tone="viewOnly">
      <strong>{t(ended.endedEarly ? "home.endedEarlyTitle" : "home.endedTitle", { date: endsLabel(ended.endedAt, t) })}</strong>{" "}
      {t.plural("home.endedBody", assigned, { by: ended.grantedByName ?? t("home.yourDm"), start: shortDateTime(ended.startsAt, t), end: shortDateTime(ended.expiresAt, t) })}
    </AccessBanner>
  );
}

/** V5 SP01 / DD01 left column and DM01 bottom row. */
function AttentionCard({ home, n, t }: { home: HomeSummary; n: number; t: Translator }) {
  const isDm = home.role === "DISTRICT_MANAGER";
  const total = home.societies.total;
  return (
    <Card
      action={
        <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/my-societies">
          {t.plural("home.allSocieties", total)}
        </Link>
      }
      eyebrow={isDm ? t("home.needsAttention") : t("home.mySocieties")}
      id="attention-heading"
      n={n}
      title={isDm ? t("home.followUp") : t("home.needsAttention")}
    >
      <AttentionTable items={home.needsAttention} showSpc={isDm} t={t} />
    </Card>
  );
}

function SpcRecentCard({ home, now, t }: { home: HomeSummary; now: Date; t: Translator }) {
  return (
    <Card eyebrow={t("home.activity")} id="recent-heading" n={2} title={t("home.latest")}>
      {home.recent.length ? (
        <ul className="flex flex-col gap-3">
          {home.recent.map((change, index) => (
            <li key={`${change.at}-${index}`}>
              <strong className="block text-[12.5px] text-ink">
                {actionLabel(change.action)}
                {change.detail ? ` · ${change.detail}` : ""}
                {change.societyName ? ` · ${change.societyName}` : ""}
              </strong>
              <span className="text-[11px] text-ink-soft">
                {change.actorName ?? t("home.someone")}
                {change.actorRole ? ` (${shortRole(change.actorRole, t)})` : ""} · {updatedLabel(change.at, now, t)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-soft">{t("home.noChanges")}</p>
      )}
    </Card>
  );
}

/** The grade mix of the active societies in scope, as a donut beside the same numbers. */
function GradesCard({ home, n, t, title, viewOnly }: { home: HomeSummary; n: number; t: Translator; title: string; viewOnly?: boolean }) {
  const { grades, notActive, active } = home.societies;
  const ungraded = Math.max(0, active - grades.A - grades.B - grades.C);
  const rows = (["A", "B", "C"] as const).map((grade) => ({ key: grade, value: grades[grade], colour: GRADE_STYLE[grade].colour }));
  return (
    <Card action={viewOnly ? <ViewOnlyChip t={t} /> : undefined} eyebrow={t("home.societies")} id="grades-heading" n={n} title={title}>
      <div className="flex flex-1 flex-wrap items-center gap-5">
        <Donut
          centre={
            <span>
              <strong className="block text-[20px] leading-none text-ink">{active}</strong>
              <span className="text-[10px] text-muted">{t("home.activeLower")}</span>
            </span>
          }
          label={t("home.gradeChart", { a: grades.A, b: grades.B, c: grades.C, ungraded })}
          segments={rows}
          size={116}
          thickness={14}
        />
        <ul className="flex min-w-[140px] flex-1 flex-col gap-1.5">
          {rows.map((row) => (
            <li className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-surface-muted" key={row.key}>
              <GradeBadge grade={row.key} />
              <strong className="text-[15px] text-ink">{row.value}</strong>
            </li>
          ))}
          {ungraded > 0 && (
            <li className="flex items-center justify-between gap-3 px-2 py-1 text-[12px] text-ink-soft">
              <span>{t("home.notGradedYet")}</span>
              <strong className="text-[15px] text-ink">{ungraded}</strong>
            </li>
          )}
        </ul>
      </div>
      <p className="text-[11px] text-ink-soft">{t("home.notActiveNote", { count: notActive })}</p>
    </Card>
  );
}

/**
 * This year's reporting, from the same records the figures above use: yearly
 * summaries for the financial year among active societies, and work plans for
 * the plan year among all societies in scope. Nothing in scope reads "—", not 0%.
 */
function ReportingCard({ home, n, t }: { home: HomeSummary; n: number; t: Translator }) {
  const { active, total } = home.societies;
  const summaries = Math.max(0, active - home.yearlySummaryMissing);
  const rows = [
    {
      key: "summaries",
      label: t("home.summariesAdded", { year: home.financialYear.label }),
      line: t("home.ofActive", { done: summaries, count: active }),
      missing: home.yearlySummaryMissing > 0 ? t("home.missingCount", { count: home.yearlySummaryMissing }) : null,
      value: active === 0 ? null : share(summaries, active),
    },
    {
      key: "plans",
      label: t("home.plansAdded", { year: home.planYear }),
      line: t("home.ofTotal", { done: home.societiesWithPlan, count: total }),
      missing: total - home.societiesWithPlan > 0 ? t("home.withoutPlan", { count: total - home.societiesWithPlan }) : null,
      value: total === 0 ? null : share(home.societiesWithPlan, total),
    },
  ];
  return (
    <Card eyebrow={t("home.reporting")} id="reporting-heading" n={n} title={t("home.reportingTitle")}>
      <ul className="flex flex-1 flex-col gap-3">
        {rows.map((row) => (
          <li className="flex items-center gap-3 rounded-xl border border-line-soft px-3 py-3" key={row.key}>
            <Ring size={52} thickness={6} value={row.value}>
              <span className="text-[10.5px] font-bold text-ink">{row.value === null ? "—" : `${row.value}%`}</span>
            </Ring>
            <span className="min-w-0 text-[12px] leading-snug">
              <strong className="block break-words text-ink">{row.label}</strong>
              <span className="text-ink-soft">{row.line}</span>
              {row.missing && <span className="block font-semibold text-danger-text">{row.missing}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted">{t("home.reportingNote")}</p>
    </Card>
  );
}

/**
 * DD01: the DDM's two kinds of access side by side, so editing their own
 * societies is never confused with the temporary, view-only district view.
 */
function DdmAccessCard({ home, n, now, t }: { home: HomeSummary; n: number; now: Date; t: Translator }) {
  const grant = home.temporaryAccess[0];
  const ended = home.recentlyEnded;
  const district = home.district?.name ?? t("home.districtWord");
  const status = grant
    ? { label: t("home.activeViewOnly"), tone: "bg-info-bg text-info-text" }
    : ended
      ? { label: t("home.ended"), tone: "bg-[#f0f1ee] text-[#56615a]" }
      : { label: t("home.none"), tone: "bg-[#f0f1ee] text-[#56615a]" };
  return (
    <section aria-labelledby="access-heading" className={`${styles.card} p-5`}>
      <h2 className="text-[15px] font-bold text-ink" id="access-heading">
        <span aria-hidden="true" className="mr-2 inline-grid size-6 place-items-center rounded-full bg-brand-mint text-[10.5px] font-bold text-brand-forest align-middle">
          {n}
        </span>
        {t("home.yourAccessHead")}
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] p-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-ink">{t("home.accessAssignedTitle")}</h3>
            <span className="inline-flex items-center gap-1 rounded-pill bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success-text">
              <Icon className="size-3" name="check" strokeWidth={2.4} />
              {t("home.editable")}
            </span>
          </span>
          <p className="text-[12.5px] text-ink">{t.plural("home.accessAssignedBody", home.societies.total)}</p>
          <p className="text-[11px] text-ink-soft">{t("home.accessAssignedNote")}</p>
          <Link className="mt-auto w-fit text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/my-societies">
            {t("home.openMySocieties")}
          </Link>
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--banner-temporary-line)] bg-[var(--banner-temporary-bg)] p-4">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-ink">{t("home.districtWide")}</h3>
            <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${status.tone}`}>
              <span aria-hidden="true">●</span> {status.label}
            </span>
          </span>
          {grant ? (
            <>
              <p className="text-[12.5px] text-ink">{t("home.tempScope", { count: home.districtViewCount ?? grant.districtSocietyCount, district: grant.districtName })}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px]">
                <dt className="text-ink-soft">{t("home.accessEnds")}</dt>
                <dd className="font-semibold text-ink">{t("home.tempBannerAction", { date: endsLabel(grant.expiresAt, t), left: timeLeft(grant.expiresAt, now, t) })}</dd>
                <dt className="text-ink-soft">{t("home.accessGivenBy")}</dt>
                <dd className="text-ink">{grant.grantedByName ?? t("home.yourDm")}</dd>
              </dl>
              <p className="text-[11px] text-ink-soft">{t("home.lookEvery", { district: grant.districtName, date: endsLabel(grant.expiresAt, t) })}</p>
              <Link
                className={`${styles.press} ${styles.focusRing} mt-auto inline-flex min-h-9 w-fit items-center gap-1.5 rounded-[10px] border border-button-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-brand-mint-soft`}
                href="/my-societies?scope=DISTRICT"
              >
                <Icon className="size-4" name="list" strokeWidth={2} />
                {t("home.browseDistrict")}
              </Link>
            </>
          ) : ended ? (
            <p className="text-[12.5px] text-ink">
              <strong className="block">{t(ended.endedEarly ? "home.accessEndedEarlyOn" : "home.accessEndedOn", { date: endsLabel(ended.endedAt, t) })}</strong>
              {t("home.noDistrictNow")}
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-soft">{t("home.noneActiveDm", { district })}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function StaffCard({ home, n, t }: { home: HomeSummary; n: number; t: Translator }) {
  const th = "px-3 py-2 text-left text-[11px] font-medium text-muted";
  return (
    <Card action={<ViewOnlyChip t={t} />} eyebrow={t("home.staff")} id="staff-heading" n={n} title={t("home.ddmsSpcs", { count: home.staff.length })}>
      {home.staff.length ? (
        <div className="relative overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-muted">
              <tr>
                <th className={th} scope="col">{t("home.staff")}</th>
                <th className={th} scope="col">{t("home.societies")}</th>
                <th className={th} scope="col">{t("home.notUpdatedDays", { days: home.notUpdated.days })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {home.staff.map((member) => (
                <tr key={member.id}>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink">
                    {member.displayName} ({shortRole(member.role, t)})
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink">{member.societyCount}</td>
                  <td className={`px-3 py-2.5 text-[12.5px] ${member.notUpdatedCount ? "font-semibold text-danger-text" : "text-ink"}`}>{member.notUpdatedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-soft">{t("home.noStaff")}</p>
      )}
    </Card>
  );
}

/**
 * V5 SP01 (SPC), DD01 (DDM) and DM01 (DM). Every number comes from the API,
 * worked out from the societies the user covers. Figures are numbers, rings
 * and a donut, never progress bars; cards in a row are the same height.
 *
 * Each role's home leads with its own work: the SPC's approvals, the DDM's
 * two kinds of access, the DM's district status and reporting.
 */
export function RoleHome({ home, viewer, now = new Date(), t = ENGLISH }: { home: HomeSummary; viewer: DemoViewer; now?: Date; t?: Translator }) {
  const isDm = home.role === "DISTRICT_MANAGER";
  const isSpc = home.role === "PROGRAMME_COORDINATOR";
  const isDdm = home.role === "DEPUTY_DISTRICT_MANAGER";
  const access = accessSentence(home, t);
  const total = home.societies.total;
  const latest = home.gradeRequests.latest;
  const stale = home.notUpdated;
  const grant = home.temporaryAccess[0];

  const gradeTile = (detail: ReactNode) => (
    <Tile detail={detail} href="/my-societies?gradeRequest=PENDING" icon="review" label={t("home.requestsHq")} tone={home.gradeRequests.pending ? "amber" : "ink"} value={String(home.gradeRequests.pending)} />
  );
  const staleTile = (detail: ReactNode) => (
    <Tile detail={detail} href="/my-societies?needsUpdate=true" icon="clock" label={t("home.notUpdatedPlus", { days: stale.days })} tone={stale.count ? "red" : "ink"} value={String(stale.count)} />
  );

  const tiles = isDm ? (
    <>
      <Tile detail={t("home.activeNotActive", { active: home.societies.active, notActive: home.societies.notActive })} href="/my-societies" icon="society" label={t("home.societies")} value={String(total)} />
      <Tile detail={t("home.latestCounts")} href="/membership" icon="people" label={t("nav.membersShort")} value={(home.societies.members ?? 0).toLocaleString("en-GB")} />
      {gradeTile(t("home.viewOnly"))}
      {staleTile(stale.societyNames.join(", ") || t("home.none"))}
      <Tile
        detail={home.temporaryAccess.length ? t("home.activeNames", { names: home.temporaryAccess.map((g) => g.deputyName).join(", ") }) : t("home.noneActive")}
        href="/district-access"
        icon="key"
        label={t("home.tempDdm")}
        value={String(home.temporaryAccess.length)}
      />
    </>
  ) : isSpc ? (
    <>
      <Tile
        detail={home.activitiesWaiting ? t("home.approveDetail") : t("home.noneWaiting")}
        href="/activities-to-approve"
        icon="check"
        label={t("nav.activitiesToApprove")}
        tone={home.activitiesWaiting ? "amber" : "ink"}
        value={String(home.activitiesWaiting)}
      />
      <Tile detail={gradeLine(home.societies.grades)} href="/my-societies" icon="society" label={t("home.assignedSocieties")} value={String(total)} />
      {gradeTile(latest ? `${latest.societyName} · ${waitedLabel(latest.requestedAt, now, t)}` : t("home.noneWaiting"))}
      {staleTile(stale.societyNames.join(", ") || t("home.none"))}
      <Tile detail={home.financialYear.label} icon="clipboard" label={t("home.yearlyMissing")} tone={home.yearlySummaryMissing ? "amber" : "ink"} value={String(home.yearlySummaryMissing)} />
      <Tile detail={t("home.ofAssigned", { count: total })} icon="list" label={t("home.withPlan", { year: home.planYear })} value={String(home.societiesWithPlan)} />
    </>
  ) : (
    <>
      <Tile detail={t("home.viewAndEdit")} href="/my-societies" icon="society" label={t("home.assignedSocieties")} value={String(total)} />
      {gradeTile(latest ? t("home.fromYours") : t("home.noneWaiting"))}
      {staleTile(t("home.ofYour", { count: total }))}
      <Tile
        detail={home.districtViewCount === null || !grant ? t("home.onlyTemp") : t("home.viewOnlyUntil", { date: endsLabel(grant.expiresAt, t) })}
        href={home.districtViewCount === null || !grant ? undefined : "/my-societies?scope=DISTRICT"}
        icon="district"
        label={t("home.districtSocieties")}
        value={home.districtViewCount === null ? "—" : String(home.districtViewCount)}
      />
    </>
  );

  const actions = isDm ? (
    <>
      <QuickAction href="/my-societies" icon="list" label={t("home.qaDistrictSocieties")} primary />
      <QuickAction href="/district-access" icon="key" label={t("home.tempDdm")} />
      <QuickAction href="/emergencies" icon="alert" label={t("nav.disasterResponse")} />
    </>
  ) : (
    <>
      {isSpc && <QuickAction href="/activities-to-approve" icon="check" label={t("home.qaReview")} primary />}
      <QuickAction href="/my-societies" icon="list" label={t("nav.mySocieties")} primary={isDdm} />
      <QuickAction danger href="/dashboard?report=incident" icon="alert" label={t("home.reportIncident")} />
    </>
  );

  return (
    <div className={`${styles.root} flex flex-col gap-4`}>
      <div className={`${styles.enter} flex flex-wrap items-end justify-between gap-4`} style={order(0)}>
        <div className="min-w-0">
          <h1 className="break-words text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {isDm ? t("home.districtOverview") : t("home.greeting", { greeting: greeting(now, t), name: viewer.displayName })}
          </h1>
          <p className="mt-1 break-words text-[12.5px] text-ink-soft">
            {isDm ? home.district?.name : t(ROLE_TITLE[home.role])}
            {isDdm && home.district ? ` · ${home.district.name}` : ""} · {longDate(now, t)}
          </p>
        </div>
        <nav aria-label={t("home.quickActions")} className="flex flex-wrap gap-2">
          {actions}
        </nav>
      </div>

      <div className={`${styles.enter} flex flex-col gap-3`} style={order(1)}>
        <AccessBanner tone={isDm ? "viewOnly" : "edit"}>
          {t.rich("home.yourAccess", { strong: <strong>{access.strong}</strong>, rest: access.rest })}
        </AccessBanner>
        {isDdm && grant && <TemporaryViewBanner grant={grant} now={now} t={t} />}
        {isDdm && home.recentlyEnded && <AccessEndedBanner assigned={total} ended={home.recentlyEnded} t={t} />}
        <IncidentBanners home={home} now={now} t={t} />
      </div>

      <ul aria-label={t("home.keyFigures")} className={`${styles.enter} grid gap-3 sm:grid-cols-2 ${isSpc ? "lg:grid-cols-3 2xl:grid-cols-6" : isDm ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-4"}`} style={order(2)}>
        {tiles}
      </ul>

      {isDm && (
        <>
          <div className={`${styles.enter} grid items-stretch gap-4 lg:grid-cols-3`} style={order(3)}>
            <GradesCard home={home} n={1} t={t} title={t("home.gradesIn", { district: home.district?.name ?? t("home.theDistrict") })} viewOnly />
            <ReportingCard home={home} n={2} t={t} />
            <TemporaryAccessCard home={home} n={3} now={now} t={t} />
          </div>
          <div className={`${styles.enter} grid items-stretch gap-4 xl:grid-cols-[1.7fr_1fr]`} style={order(4)}>
            <AttentionCard home={home} n={4} t={t} />
            <StaffCard home={home} n={5} t={t} />
          </div>
        </>
      )}

      {isDdm && (
        <div className={styles.enter} style={order(3)}>
          <DdmAccessCard home={home} n={1} now={now} t={t} />
        </div>
      )}

      {!isDm && (
        <div className={`${styles.enter} grid items-stretch gap-4 lg:grid-cols-[1.7fr_1fr]`} style={order(isDdm ? 4 : 3)}>
          <AttentionCard home={home} n={isDdm ? 2 : 1} t={t} />
          <div className="flex min-w-0 flex-col gap-4">
            {isSpc && <SpcRecentCard home={home} now={now} t={t} />}
            <ReportingCard home={home} n={3} t={t} />
            <IncidentsCard home={home} n={4} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}
