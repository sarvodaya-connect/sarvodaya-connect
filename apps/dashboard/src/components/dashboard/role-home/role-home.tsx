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
import { Icon } from "../icon";
import { AccessBanner } from "../ui/access-banner";

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

/** A V5 summary tile: label, big number, one line of detail. Numbers only, never a bar. */
function Tile({ label, value, detail, tone = "ink" }: { label: string; value: string; detail: ReactNode; tone?: Tone }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3.5">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <strong className={`text-[26px] font-bold leading-tight ${toneClass[tone]}`}>{value}</strong>
      <span className="truncate text-[11px] text-ink-soft">{detail}</span>
    </div>
  );
}

/** Numbered V5 card. Cards in a row stretch to the same height, so no row has gaps. */
function Card({ n, eyebrow, title, action, children, id }: { n: number; eyebrow: string; title: string; action?: ReactNode; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">
            {n} · {eyebrow}
          </p>
          <h2 className="text-[15px] font-bold text-ink" id={id}>
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
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
      <p className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">
        <Icon className="size-4 text-brand-leaf" name="success" />
        {t("home.nothingAttention")}
      </p>
    );
  }
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
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
            <tr key={`${item.societyId}-${index}`}>
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
  const button =
    "inline-flex h-9 items-center gap-1.5 rounded-button border px-3.5 text-[12.5px] font-semibold";
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

function TemporaryAccessCard({ home, n, now, t }: { home: HomeSummary; n: number; now: Date; t: Translator }) {
  const grant = home.temporaryAccess[0];
  const isDm = home.role === "DISTRICT_MANAGER";
  const status = (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${grant ? "bg-info-bg text-info-text" : "bg-[#f0f1ee] text-[#56615a]"}`}>
      <span aria-hidden="true">●</span> {grant ? (isDm ? t("home.active") : t("home.activeViewOnly")) : t("home.none")}
    </span>
  );
  if (isDm) {
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
  return (
    <Card action={status} eyebrow={t("home.temporaryAccess")} id="temporary-access-heading" n={n} title={t("home.districtWide")}>
      {grant ? (
        <div className="flex flex-1 flex-col justify-between gap-3">
          <p className="text-[12.5px] text-ink-soft">
            {t("home.lookEvery", { district: grant.districtName, date: endsLabel(grant.expiresAt, t) })}
          </p>
          <Link
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-button border border-button-line px-3.5 text-[12.5px] font-semibold text-ink hover:bg-brand-mint-soft"
            href="/my-societies?scope=DISTRICT"
          >
            <Icon className="size-4" name="list" strokeWidth={2} />
            {t("home.browseDistrict")}
          </Link>
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-soft">
          {t("home.noneActiveDm", { district: home.district?.name ?? t("home.districtWord") })}
        </p>
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

function GradesCard({ home, t }: { home: HomeSummary; t: Translator }) {
  const { grades, notActive } = home.societies;
  return (
    <Card action={<ViewOnlyChip t={t} />} eyebrow={t("home.societies")} id="grades-heading" n={1} title={t("home.gradesIn", { district: home.district?.name ?? t("home.theDistrict") })}>
      <ul className="flex flex-1 flex-col justify-around gap-2">
        {(["A", "B", "C"] as const).map((grade) => (
          <li className="flex items-center justify-between" key={grade}>
            <GradeBadge grade={grade} />
            <strong className="text-[14px] text-ink">{grades[grade]}</strong>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-soft">{t("home.notActiveNote", { count: notActive })}</p>
    </Card>
  );
}

function StaffCard({ home, t }: { home: HomeSummary; t: Translator }) {
  const th = "px-3 py-2 text-left text-[11px] font-medium text-muted";
  return (
    <Card action={<ViewOnlyChip t={t} />} eyebrow={t("home.staff")} id="staff-heading" n={2} title={t("home.ddmsSpcs", { count: home.staff.length })}>
      {home.staff.length ? (
        <div className="overflow-x-auto rounded-lg border border-line">
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
 * worked out from the societies the user covers. Figures are numbers and
 * badges, never progress bars; cards in a row are the same height.
 */
export function RoleHome({ home, viewer, now = new Date(), t = ENGLISH }: { home: HomeSummary; viewer: DemoViewer; now?: Date; t?: Translator }) {
  const isDm = home.role === "DISTRICT_MANAGER";
  const isSpc = home.role === "PROGRAMME_COORDINATOR";
  const access = accessSentence(home, t);
  const total = home.societies.total;
  const latest = home.gradeRequests.latest;
  const stale = home.notUpdated;

  const tiles = isDm ? (
    <>
      <Tile detail={t("home.activeNotActive", { active: home.societies.active, notActive: home.societies.notActive })} label={t("home.societies")} value={String(total)} />
      <Tile detail={t("home.latestCounts")} label={t("nav.membersShort")} value={(home.societies.members ?? 0).toLocaleString("en-GB")} />
      <Tile detail={t("home.viewOnly")} label={t("home.requestsHq")} tone={home.gradeRequests.pending ? "amber" : "ink"} value={String(home.gradeRequests.pending)} />
      <Tile detail={stale.societyNames.join(", ") || t("home.none")} label={t("home.notUpdatedPlus", { days: stale.days })} tone={stale.count ? "red" : "ink"} value={String(stale.count)} />
      <Tile
        detail={home.temporaryAccess.length ? t("home.activeNames", { names: home.temporaryAccess.map((g) => g.deputyName).join(", ") }) : t("home.noneActive")}
        label={t("home.tempDdm")}
        value={String(home.temporaryAccess.length)}
      />
    </>
  ) : (
    <>
      <Tile detail={isSpc ? gradeLine(home.societies.grades) : t("home.viewAndEdit")} label={t("home.assignedSocieties")} value={String(total)} />
      <Tile
        detail={latest ? (isSpc ? `${latest.societyName} · ${waitedLabel(latest.requestedAt, now, t)}` : t("home.fromYours")) : t("home.noneWaiting")}
        label={t("home.requestsHq")}
        tone={home.gradeRequests.pending ? "amber" : "ink"}
        value={String(home.gradeRequests.pending)}
      />
      <Tile
        detail={isSpc ? stale.societyNames.join(", ") || t("home.none") : t("home.ofYour", { count: total })}
        label={t("home.notUpdatedPlus", { days: stale.days })}
        tone={stale.count ? "red" : "ink"}
        value={String(stale.count)}
      />
      {isSpc ? (
        <>
          <Tile detail={home.financialYear.label} label={t("home.yearlyMissing")} tone={home.yearlySummaryMissing ? "amber" : "ink"} value={String(home.yearlySummaryMissing)} />
          <Tile detail={t("home.ofAssigned", { count: total })} label={t("home.withPlan", { year: home.planYear })} value={String(home.societiesWithPlan)} />
        </>
      ) : (
        <Tile
          detail={home.districtViewCount === null ? t("home.onlyTemp") : t("home.viewOnlyUntil", { date: endsLabel(home.temporaryAccess[0]!.expiresAt, t) })}
          label={t("home.districtSocieties")}
          value={home.districtViewCount === null ? "—" : String(home.districtViewCount)}
        />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">{isDm ? t("home.districtOverview") : t("home.greeting", { greeting: greeting(now, t), name: viewer.displayName })}</h1>
        <p className="text-[12.5px] text-ink-soft">
          {isDm ? home.district?.name : t(ROLE_TITLE[home.role])}
          {home.role === "DEPUTY_DISTRICT_MANAGER" && home.district ? ` · ${home.district.name}` : ""} · {longDate(now, t)}
        </p>
      </div>

      <AccessBanner tone={isDm ? "viewOnly" : "edit"}>
        {t.rich("home.yourAccess", { strong: <strong>{access.strong}</strong>, rest: access.rest })}
      </AccessBanner>
      {!isDm && !isSpc && home.temporaryAccess[0] && <TemporaryViewBanner grant={home.temporaryAccess[0]} now={now} t={t} />}
      {!isDm && !isSpc && home.recentlyEnded && <AccessEndedBanner assigned={total} ended={home.recentlyEnded} t={t} />}
      <IncidentBanners home={home} now={now} t={t} />

      <div className={`grid gap-3 sm:grid-cols-2 ${isSpc || isDm ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>{tiles}</div>

      {isDm ? (
        <>
          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            <GradesCard home={home} t={t} />
            <StaffCard home={home} t={t} />
            <TemporaryAccessCard home={home} n={3} now={now} t={t} />
          </div>
          <AttentionCard home={home} n={4} t={t} />
        </>
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-[1.7fr_1fr]">
          <AttentionCard home={home} n={1} t={t} />
          <div className="flex min-w-0 flex-col gap-4">
            {isSpc ? <SpcRecentCard home={home} now={now} t={t} /> : <TemporaryAccessCard home={home} n={2} now={now} t={t} />}
            <IncidentsCard home={home} n={3} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}
