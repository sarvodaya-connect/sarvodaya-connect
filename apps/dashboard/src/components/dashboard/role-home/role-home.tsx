import Link from "next/link";
import type { ReactNode } from "react";

import type { HomeAttentionItem, HomeSummary } from "@sarvodaya-connect/api-contracts";

import { actionLabel } from "@/lib/audit-log";
import type { DemoViewer } from "@/lib/access";
import { endDistrictAccess } from "@/app/(dashboard)/district-access/actions";
import { accessSentence, endsLabel, gradeLine, greeting, longDate, SHORT_ROLE, shortDateTime, timeLeft, updatedLabel, waitedLabel } from "@/lib/home-format";

import { EndAccessButton } from "../district-access/access-controls";

import { GradeBadge } from "../grade-queue/grade-badge";
import { Icon } from "../icon";
import { AccessBanner } from "../ui/access-banner";

/** "today", "yesterday" or "on 02 Oct", to read inside a sentence. */
function sinceLabel(value: string, now: Date) {
  const label = updatedLabel(value, now);
  return label === "Today" || label === "Yesterday" ? label.toLowerCase() : `on ${label}`;
}

const ROLE_TITLE: Record<HomeSummary["role"], string> = {
  PROGRAMME_COORDINATOR: "Society Program Coordinator (SPC)",
  DEPUTY_DISTRICT_MANAGER: "Deputy District Manager (DDM)",
  DISTRICT_MANAGER: "District Manager (DM)",
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

function AccessPill({ editable }: { editable: boolean }) {
  return editable ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success-text">
      <Icon className="size-3" name="check" strokeWidth={2.4} />
      Editable
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-[#f0f1ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#56615a]">
      <Icon className="size-3" name="lock" strokeWidth={2.2} />
      View only
    </span>
  );
}

function ViewOnlyChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-[#f0f1ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#56615a]">
      <Icon className="size-3" name="lock" strokeWidth={2.2} />
      View only
    </span>
  );
}

export function PendingGradeChip({ pending }: { pending: NonNullable<HomeAttentionItem["pendingGrade"]> }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-pill bg-warn-bg px-2 py-0.5 text-[10px] font-semibold text-warn-text">
      <span aria-hidden="true">●</span> {pending.from ?? "–"} → {pending.to} with HQ
    </span>
  );
}

function AttentionTable({ items, showSpc }: { items: HomeAttentionItem[]; showSpc: boolean }) {
  if (!items.length) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">
        <Icon className="size-4 text-brand-leaf" name="success" />
        Nothing needs attention right now.
      </p>
    );
  }
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-muted">
          <tr>
            <th className={th} scope="col">Society</th>
            <th className={th} scope="col">Grade</th>
            <th className={th} scope="col">Needs Attention</th>
            {showSpc && <th className={th} scope="col">SPC</th>}
            <th className={th} scope="col"><span className="sr-only">Your Access</span></th>
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
                  {showSpc && item.pendingGrade && <PendingGradeChip pending={item.pendingGrade} />}
                </span>
              </td>
              <td className="px-3 py-3 text-[12.5px] text-ink">{item.reason}</td>
              {showSpc && <td className="px-3 py-3 text-[12.5px] text-ink">{item.spcName ?? "Not assigned"}</td>}
              <td className="px-3 py-3 text-right">
                <AccessPill editable={item.editable} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** V5 SP01 / DD01 / DM01 incident banner, with a working "Open incident" link (PR 8). */
function IncidentBanners({ home, now }: { home: HomeSummary; now: Date }) {
  return home.incidents.map((incident) => (
    <AccessBanner
      action={
        <Link className="underline underline-offset-2" href={`/emergencies/${incident.id}`}>
          Open incident
        </Link>
      }
      key={incident.id}
      tone="incident"
    >
      <strong>
        Active incident {incident.reference} · {incident.title}.
      </strong>{" "}
      Opened {incident.openedByName ? `by ${incident.openedByName}${incident.openedByRole ? ` (${SHORT_ROLE[incident.openedByRole] ?? incident.openedByRole})` : ""} ` : ""}
      {sinceLabel(incident.openedAt, now)}
      {incident.assessmentsDueAt ? ` · assessments due ${endsLabel(incident.assessmentsDueAt)}` : ""}.
    </AccessBanner>
  ));
}

/** V5 SP01 / DD01 "3 · Disaster response": open the live incident or report a new one. */
function IncidentsCard({ home, n }: { home: HomeSummary; n: number }) {
  const live = home.incidents[0];
  const button =
    "inline-flex h-9 items-center gap-1.5 rounded-button border px-3.5 text-[12.5px] font-semibold";
  return (
    <Card eyebrow="Disaster Response" id="incidents-heading" n={n} title="Incidents">
      <p className="text-[12.5px] text-ink-soft">
        You can open or close an incident, send rapid assessments and see live incidents. Response actions are assigned by HQ.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link className={`${button} border-button-line text-ink hover:bg-brand-mint-soft`} href={live ? `/emergencies/${live.id}` : "/emergencies"}>
          <Icon className="size-4" name="alert" strokeWidth={2} />
          Open incident
        </Link>
        <Link className={`${button} border-[var(--banner-incident-line)] text-danger-text hover:bg-danger-bg`} href="/dashboard?report=incident">
          + Report an incident
        </Link>
      </div>
    </Card>
  );
}

function TemporaryAccessCard({ home, n, now }: { home: HomeSummary; n: number; now: Date }) {
  const grant = home.temporaryAccess[0];
  const isDm = home.role === "DISTRICT_MANAGER";
  const status = (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${grant ? "bg-info-bg text-info-text" : "bg-[#f0f1ee] text-[#56615a]"}`}>
      <span aria-hidden="true">●</span> {grant ? (isDm ? "Active" : "Active · view only") : "None"}
    </span>
  );
  if (isDm) {
    return (
      <Card action={status} eyebrow="Temporary Access" id="temporary-access-heading" n={n} title={grant ? "Active grant" : "No Active Grant"}>
        {grant ? (
          <div className="flex flex-1 flex-col justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info-bg text-[11px] font-bold text-info-text">
                {grant.deputyName.split(" ").map((part) => part[0]).slice(0, 2).join("")}
              </span>
              <span className="text-[12px] text-ink-soft">
                <strong className="block text-[13px] text-ink">{grant.deputyName}</strong>
                View only · all {grant.districtSocietyCount} societies · ends {endsLabel(grant.expiresAt)} · {timeLeft(grant.expiresAt, now)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-8 items-center rounded-button border border-button-line px-3 text-[12px] font-semibold text-ink hover:bg-brand-mint-soft"
                href={`/district-access?grant=${grant.id}`}
              >
                See details
              </Link>
              <EndAccessButton action={endDistrictAccess} compact deputyName={grant.deputyName} grantId={grant.id} returnTo="/dashboard" />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-between gap-3">
            <p className="text-[12.5px] text-ink-soft">No DDM has temporary district access.</p>
            <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/district-access?panel=give">
              Give temporary access
            </Link>
          </div>
        )}
      </Card>
    );
  }
  return (
    <Card action={status} eyebrow="Temporary Access" id="temporary-access-heading" n={n} title="District-Wide View">
      {grant ? (
        <div className="flex flex-1 flex-col justify-between gap-3">
          <p className="text-[12.5px] text-ink-soft">
            You can look at every {grant.districtName} society until {endsLabel(grant.expiresAt)}. You cannot edit them or request grade changes for them. Societies you open are recorded in
            the access history.
          </p>
          <Link
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-button border border-button-line px-3.5 text-[12.5px] font-semibold text-ink hover:bg-brand-mint-soft"
            href="/my-societies?scope=DISTRICT"
          >
            <Icon className="size-4" name="list" strokeWidth={2} />
            Browse district societies
          </Link>
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-soft">
          None active. When your DM is away they can give you view-only access to all {home.district?.name ?? "district"} societies for a set time.
        </p>
      )}
    </Card>
  );
}

/** V5 DD02 banner: the DDM's district-wide view, with the time left as text. */
export function TemporaryViewBanner({ grant, now }: { grant: HomeSummary["temporaryAccess"][number]; now: Date }) {
  return (
    <AccessBanner action={`Ends ${endsLabel(grant.expiresAt)} · ${timeLeft(grant.expiresAt, now)}`} tone="temporary">
      <strong>Temporary District-Wide View</strong> · all {grant.districtSocietyCount} {grant.districtName} societies, <strong>view only</strong>. Given by{" "}
      {grant.grantedByName ?? "your DM"} (DM) on {shortDateTime(grant.grantedAt)}.
    </AccessBanner>
  );
}

/** V5 DD07: the district-wide view has ended; links to other district societies now show "No access". */
export function AccessEndedBanner({ ended, assigned }: { ended: NonNullable<HomeSummary["recentlyEnded"]>; assigned: number }) {
  return (
    <AccessBanner tone="viewOnly">
      <strong>Your temporary district-wide view {ended.endedEarly ? "was ended early" : "ended"} on {endsLabel(ended.endedAt)}.</strong> {ended.grantedByName ?? "Your DM"} (DM) gave it
      for {shortDateTime(ended.startsAt)} – {shortDateTime(ended.expiresAt)}. You are back to your {assigned} assigned {assigned === 1 ? "society" : "societies"}. Links to other
      district societies now show No access.
    </AccessBanner>
  );
}

/** V5 SP01 / DD01 left column and DM01 bottom row. */
function AttentionCard({ home, n }: { home: HomeSummary; n: number }) {
  const isDm = home.role === "DISTRICT_MANAGER";
  const total = home.societies.total;
  return (
    <Card
      action={
        <Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/my-societies">
          All {total} {total === 1 ? "society" : "societies"}
        </Link>
      }
      eyebrow={isDm ? "Needs Attention" : "My Societies"}
      id="attention-heading"
      n={n}
      title={isDm ? "Societies to Follow Up With Your Staff" : "Needs Attention"}
    >
      <AttentionTable items={home.needsAttention} showSpc={isDm} />
    </Card>
  );
}

function SpcRecentCard({ home, now }: { home: HomeSummary; now: Date }) {
  return (
    <Card eyebrow="Activity" id="recent-heading" n={2} title="Latest in My Societies">
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
                {change.actorName ?? "Someone"}
                {change.actorRole ? ` (${SHORT_ROLE[change.actorRole] ?? change.actorRole})` : ""} · {updatedLabel(change.at, now)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-soft">No changes in your societies yet.</p>
      )}
    </Card>
  );
}

function GradesCard({ home }: { home: HomeSummary }) {
  const { grades, notActive } = home.societies;
  return (
    <Card action={<ViewOnlyChip />} eyebrow="Societies" id="grades-heading" n={1} title={`Grades in ${home.district?.name ?? "the district"}`}>
      <ul className="flex flex-1 flex-col justify-around gap-2">
        {(["A", "B", "C"] as const).map((grade) => (
          <li className="flex items-center justify-between" key={grade}>
            <GradeBadge grade={grade} />
            <strong className="text-[14px] text-ink">{grades[grade]}</strong>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-soft">{notActive} not active. Grades change only with HQ approval.</p>
    </Card>
  );
}

function StaffCard({ home }: { home: HomeSummary }) {
  const th = "px-3 py-2 text-left text-[11px] font-medium text-muted";
  return (
    <Card action={<ViewOnlyChip />} eyebrow="Staff" id="staff-heading" n={2} title={`DDMs and SPCs (${home.staff.length})`}>
      {home.staff.length ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-muted">
              <tr>
                <th className={th} scope="col">Staff</th>
                <th className={th} scope="col">Societies</th>
                <th className={th} scope="col">Not Updated {home.notUpdated.days}d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {home.staff.map((member) => (
                <tr key={member.id}>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink">
                    {member.displayName} ({SHORT_ROLE[member.role]})
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] text-ink">{member.societyCount}</td>
                  <td className={`px-3 py-2.5 text-[12.5px] ${member.notUpdatedCount ? "font-semibold text-danger-text" : "text-ink"}`}>{member.notUpdatedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-soft">No DDM or SPC is assigned to societies in this district yet.</p>
      )}
    </Card>
  );
}

/**
 * V5 SP01 (SPC), DD01 (DDM) and DM01 (DM). Every number comes from the API,
 * worked out from the societies the user covers. Figures are numbers and
 * badges, never progress bars; cards in a row are the same height.
 */
export function RoleHome({ home, viewer, now = new Date() }: { home: HomeSummary; viewer: DemoViewer; now?: Date }) {
  const isDm = home.role === "DISTRICT_MANAGER";
  const isSpc = home.role === "PROGRAMME_COORDINATOR";
  const access = accessSentence(home);
  const total = home.societies.total;
  const latest = home.gradeRequests.latest;
  const stale = home.notUpdated;

  const tiles = isDm ? (
    <>
      <Tile detail={`${home.societies.active} active · ${home.societies.notActive} not active`} label="Societies" value={String(total)} />
      <Tile detail="From the latest membership counts" label="Members" value={(home.societies.members ?? 0).toLocaleString("en-GB")} />
      <Tile detail="View only" label="Grade Requests With HQ" tone={home.gradeRequests.pending ? "amber" : "ink"} value={String(home.gradeRequests.pending)} />
      <Tile detail={stale.societyNames.join(", ") || "None"} label={`Not Updated ${stale.days}+ Days`} tone={stale.count ? "red" : "ink"} value={String(stale.count)} />
      <Tile
        detail={home.temporaryAccess.length ? `Active · ${home.temporaryAccess.map((g) => g.deputyName).join(", ")}` : "None active"}
        label="Temporary DDM Access"
        value={String(home.temporaryAccess.length)}
      />
    </>
  ) : (
    <>
      <Tile detail={isSpc ? gradeLine(home.societies.grades) : "view and edit"} label="Assigned Societies" value={String(total)} />
      <Tile
        detail={latest ? (isSpc ? `${latest.societyName} · ${waitedLabel(latest.requestedAt, now)}` : "from your societies") : "None waiting"}
        label="Grade Requests With HQ"
        tone={home.gradeRequests.pending ? "amber" : "ink"}
        value={String(home.gradeRequests.pending)}
      />
      <Tile
        detail={isSpc ? stale.societyNames.join(", ") || "None" : `of your ${total}`}
        label={`Not Updated ${stale.days}+ Days`}
        tone={stale.count ? "red" : "ink"}
        value={String(stale.count)}
      />
      {isSpc ? (
        <>
          <Tile detail={home.financialYear.label} label="Yearly Summary Missing" tone={home.yearlySummaryMissing ? "amber" : "ink"} value={String(home.yearlySummaryMissing)} />
          <Tile detail={`of ${total} assigned`} label={`Societies With a ${home.planYear} Plan`} value={String(home.societiesWithPlan)} />
        </>
      ) : (
        <Tile
          detail={home.districtViewCount === null ? "Only with temporary access from your DM" : `View only · until ${endsLabel(home.temporaryAccess[0]!.expiresAt)}`}
          label="District Societies"
          value={home.districtViewCount === null ? "—" : String(home.districtViewCount)}
        />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">{isDm ? "District Overview" : `${greeting(now)}, ${viewer.displayName}`}</h1>
        <p className="text-[12.5px] text-ink-soft">
          {isDm ? home.district?.name : ROLE_TITLE[home.role]}
          {home.role === "DEPUTY_DISTRICT_MANAGER" && home.district ? ` · ${home.district.name}` : ""} · {longDate(now)}
        </p>
      </div>

      <AccessBanner tone={isDm ? "viewOnly" : "edit"}>
        Your access: <strong>{access.strong}</strong>
        {access.rest}
      </AccessBanner>
      {!isDm && !isSpc && home.temporaryAccess[0] && <TemporaryViewBanner grant={home.temporaryAccess[0]} now={now} />}
      {!isDm && !isSpc && home.recentlyEnded && <AccessEndedBanner assigned={total} ended={home.recentlyEnded} />}
      <IncidentBanners home={home} now={now} />

      <div className={`grid gap-3 sm:grid-cols-2 ${isSpc || isDm ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>{tiles}</div>

      {isDm ? (
        <>
          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            <GradesCard home={home} />
            <StaffCard home={home} />
            <TemporaryAccessCard home={home} n={3} now={now} />
          </div>
          <AttentionCard home={home} n={4} />
        </>
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-[1.7fr_1fr]">
          <AttentionCard home={home} n={1} />
          <div className="flex min-w-0 flex-col gap-4">
            {isSpc ? <SpcRecentCard home={home} now={now} /> : <TemporaryAccessCard home={home} n={2} now={now} />}
            <IncidentsCard home={home} n={3} />
          </div>
        </div>
      )}
    </div>
  );
}
