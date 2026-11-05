import Link from "next/link";
import type { ReactNode } from "react";

import type {
  EmergencyActionState,
  EmergencyHelperStatus,
  EmergencyHistoryEntry,
  EmergencyIncidentSummary,
  EmergencyResponseAction,
  EmergencySituationReport,
  EmergencySocietyRow,
  EmergencySocietyState,
  EmergencyTotals,
} from "@sarvodaya-connect/api-contracts";

import {
  ACTION_STATE_LABELS,
  areaLine,
  closedLine,
  dueLine,
  HELPER_STATUS_LABELS,
  HISTORY_LABELS,
  type IncidentTab,
  NEED_LABELS,
  needsLine,
  openedByLine,
  quantityLine,
  ROAD_LABELS,
  STATE_LABELS,
} from "@/lib/emergency-format";
import { SHORT_ROLE, shortDateTime } from "@/lib/home-format";

import { Icon } from "../icon";

const number = (value: number) => value.toLocaleString("en-GB");

type Tone = "red" | "amber" | "green" | "blue" | "grey";
const badgeTone: Record<Tone, string> = {
  red: "bg-danger-bg text-danger-text",
  amber: "bg-warn-bg text-warn-text",
  green: "bg-success-bg text-success-text",
  blue: "bg-info-bg text-info-text",
  grey: "bg-[#f0f1ee] text-[#56615a]",
};

/** A status badge with a dot. Statuses are always badges, never bars. */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-[10.5px] font-semibold ${badgeTone[tone]}`}>
      <span aria-hidden="true">●</span>
      {children}
    </span>
  );
}

const STATE_TONE: Record<EmergencySocietyState, Tone> = { SAFE: "green", AFFECTED: "amber", CRITICAL: "red", NOT_ASSESSED: "grey" };
const ACTION_TONE: Record<EmergencyActionState, Tone> = { NEEDED: "red", ASSIGNED: "blue", IN_PROGRESS: "amber", DELIVERED: "green" };

export function StateBadge({ state }: { state: EmergencySocietyState }) {
  return <Badge tone={STATE_TONE[state]}>{STATE_LABELS[state]}</Badge>;
}

export function ActionBadge({ state }: { state: EmergencyActionState }) {
  return <Badge tone={ACTION_TONE[state]}>{ACTION_STATE_LABELS[state]}</Badge>;
}

export function HelperBadge({ status }: { status: EmergencyHelperStatus }) {
  return <Badge tone={ACTION_TONE[status]}>{HELPER_STATUS_LABELS[status]}</Badge>;
}

const linkClass = "font-semibold text-brand-forest underline underline-offset-2";
const eyebrowClass = "text-[10px] font-bold tracking-[0.08em] text-brand-forest";

/** A V5 card with an eyebrow and title. Cards in a row stretch to the same height. */
export function Card({ eyebrow, title, action, children, id }: { eyebrow: string; title: string; action?: ReactNode; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={eyebrowClass}>{eyebrow}</p>
          <h2 className="text-[15px] font-bold text-ink" id={id}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** "Disaster response › INC-2026-09 › Response actions" */
export function Breadcrumb({ incident, page }: { incident?: EmergencyIncidentSummary; page?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-soft">
      <Link className={linkClass} href="/emergencies">Disaster Response</Link>
      {incident && (
        <>
          <span aria-hidden="true">›</span>
          {page ? <Link className={linkClass} href={`/emergencies/${incident.id}`}>{incident.reference}</Link> : <span>{incident.reference}</span>}
        </>
      )}
      {page && (
        <>
          <span aria-hidden="true">›</span>
          <span>{page}</span>
        </>
      )}
    </nav>
  );
}

/** V5 D31 / IR01 header: name, reference, area, who opened it and the assessment deadline. */
export function IncidentHeader({ incident, actions, now }: { incident: EmergencyIncidentSummary; actions?: ReactNode; now: Date }) {
  const live = incident.status !== "CLOSED";
  const due = dueLine(incident, now);
  const closed = closedLine(incident);
  return (
    <section
      aria-labelledby="incident-heading"
      className={`flex flex-wrap items-center gap-4 rounded-card border px-5 py-4 ${live ? "border-[var(--banner-incident-line)] border-l-4 border-l-danger-dot bg-[#fdf3f2]" : "border-line bg-surface"}`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${live ? "bg-danger-bg text-danger-text" : "bg-surface-muted text-ink-soft"}`}>
        <Icon className="size-5" name="alert" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="flex flex-wrap items-center gap-2 text-[20px] font-bold text-ink" id="incident-heading">
          {incident.title} · {incident.reference}
          {live ? <Badge tone="red">LIVE</Badge> : <Badge tone="grey">Closed</Badge>}
        </h1>
        <p className="mt-0.5 text-[12px] text-ink-soft">
          {areaLine(incident)} · {number(incident.societiesInArea)} societies in the area · opened by {openedByLine(incident)} {shortDateTime(incident.openedAt)}
          {due ? ` · ${due}` : ""}
        </p>
        {closed && <p className="mt-0.5 text-[12px] font-semibold text-ink">Closed by {closed}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

/** Tabs with counts, as links so each tab has its own address. */
export function IncidentTabs({ incidentId, current, counts }: { incidentId: string; current: IncidentTab; counts: Record<Exclude<IncidentTab, "overview">, number> }) {
  const tabs: [IncidentTab, string, number | null][] = [
    ["overview", "Overview", null],
    ["assessments", "Assessments", counts.assessments],
    ["actions", "Response Actions", counts.actions],
    ["reports", "Situation reports", counts.reports],
  ];
  return (
    <nav aria-label="Incident Sections" className="flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map(([tab, label, count]) => (
        <Link
          aria-current={tab === current ? "page" : undefined}
          className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-[13px] ${tab === current ? "border-brand-forest font-bold text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
          href={tab === "overview" ? `/emergencies/${incidentId}` : `/emergencies/${incidentId}?tab=${tab}`}
          key={tab}
        >
          {label}
          {count !== null && <span className="rounded-pill bg-surface-muted px-1.5 text-[10px] font-semibold text-ink-soft">{count}</span>}
        </Link>
      ))}
    </nav>
  );
}

function Tile({ label, value, detail, tone = "ink" }: { label: string; value: string; detail: string; tone?: "ink" | "red" | "amber" }) {
  const colour = tone === "red" ? "text-danger-text" : tone === "amber" ? "text-[#a07a10]" : "text-ink";
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface px-4 py-3.5">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <strong className={`text-[26px] font-bold leading-tight ${colour}`}>{value}</strong>
      <span className="truncate text-[11px] text-ink-soft">{detail}</span>
    </div>
  );
}

/** V5 D31 / IR01 tiles: numbers only. */
export function IncidentTiles({ totals }: { totals: EmergencyTotals }) {
  return (
    <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Tile detail={`${totals.critical} critical`} label="Societies Affected" tone={totals.affected ? "red" : "ink"} value={number(totals.affected)} />
      <Tile detail={`${number(totals.people)} people`} label="Families / People Affected" value={number(totals.families)} />
      <Tile detail="From received assessments" label="Houses Fully / Partly Damaged" value={`${number(totals.housesFully)} / ${number(totals.housesPartly)}`} />
      <Tile detail={`of ${number(totals.societiesInArea)} societies`} label="Not Yet Assessed" tone={totals.notAssessed ? "amber" : "ink"} value={number(totals.notAssessed)} />
      <Tile detail={`${totals.actionsDelivered} delivered`} label="Response Actions" value={number(totals.actions)} />
    </div>
  );
}

/** V5 D31 / IR01 "Rapid assessments received". HQ sees houses and road; roles see the shorter table. */
export function AssessmentsTable({ rows, wide, incidentId, emptyText }: { rows: EmergencySocietyRow[]; wide: boolean; incidentId: string; emptyText: string }) {
  if (!rows.length) return <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">{emptyText}</p>;
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
  const td = "px-3 py-3 text-[12.5px] text-ink";
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-muted">
          <tr>
            <th className={th} scope="col">Society</th>
            <th className={th} scope="col">Status</th>
            <th className={th} scope="col">Families / People</th>
            {wide && <th className={th} scope="col">Houses Full / Part</th>}
            <th className={th} scope="col">Top Needs</th>
            {wide && <th className={th} scope="col">Road</th>}
            <th className={th} scope="col">Last Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((row) => (
            <tr key={row.society.id}>
              <td className={td}>
                <Link className={linkClass} href={`/societies/${row.society.id}`}>{row.society.name}</Link>
                <span className="block text-[11px] text-ink-soft">{row.society.districtName}</span>
              </td>
              <td className={td}><StateBadge state={row.state} /></td>
              <td className={td}>{row.families === null ? "—" : `${number(row.families)} / ${number(row.people ?? 0)}`}</td>
              {wide && <td className={td}>{row.housesFully === null ? "—" : `${row.housesFully} / ${row.housesPartly ?? 0}`}</td>}
              <td className={td}>{needsLine(row.needs)}</td>
              {wide && <td className={td}>{row.roadAccess ? ROAD_LABELS[row.roadAccess] : "Unknown"}</td>}
              <td className={td}>
                {row.lastReceivedAt ? (
                  <>
                    {shortDateTime(row.lastReceivedAt)}
                    {row.updates > 1 && <span className="block text-[11px] text-ink-soft">Update {row.updates}</span>}
                  </>
                ) : row.canAssess ? (
                  <Link className={linkClass} href={`/emergencies/${incidentId}?panel=assess&society=${row.society.id}`}>Submit assessment</Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ByDistrictTable({ totals }: { totals: EmergencyTotals }) {
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
  const td = "px-3 py-3 text-[12.5px] text-ink";
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-muted">
          <tr>
            <th className={th} scope="col">District</th>
            <th className={th} scope="col">In Area</th>
            <th className={th} scope="col">Affected</th>
            <th className={th} scope="col">Not Assessed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {totals.byDistrict.map((row) => (
            <tr key={row.districtId}>
              <td className={td}>{row.name}</td>
              <td className={td}>{number(row.inArea)}</td>
              <td className={td}>{number(row.affected)}</td>
              <td className={td}>{number(row.notAssessed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** V5 D31 "Urgent needs": a ranked list, never bars. */
export function UrgentNeeds({ totals }: { totals: EmergencyTotals }) {
  if (!totals.needs.length) return <p className="text-[12.5px] text-ink-soft">No urgent needs reported yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {totals.needs.map((row, index) => (
        <li className="flex items-center justify-between text-[12.5px]" key={row.need}>
          <strong className="text-ink">{NEED_LABELS[row.need]}</strong>
          <span className="font-semibold text-ink">{index === 0 ? `${row.societies} ${row.societies === 1 ? "society" : "societies"}` : row.societies}</span>
        </li>
      ))}
    </ul>
  );
}

/** V5 D31 "Societies helping": each society in need with its helpers. */
export function SocietiesHelping({ actions, incidentId }: { actions: EmergencyResponseAction[]; incidentId: string }) {
  const byTarget = new Map<string, Set<string>>();
  for (const action of actions) {
    if (!action.forSociety || !action.helpers.length) continue;
    const helpers = byTarget.get(action.forSociety.name) ?? new Set<string>();
    action.helpers.forEach((helper) => helpers.add(helper.society.name.replace(/ SSS$/, "")));
    byTarget.set(action.forSociety.name, helpers);
  }
  const helping = new Set(actions.flatMap((a) => a.helpers.map((h) => h.society.id))).size;
  return (
    <>
      {byTarget.size ? (
        <ul className="flex flex-col gap-1 text-[12.5px] text-ink">
          {[...byTarget].slice(0, 6).map(([target, helpers]) => (
            <li key={target}>
              <strong>{target}</strong> ← {[...helpers].join(", ")}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-soft">No helping societies assigned yet.</p>
      )}
      <p className="text-[12px] text-ink-soft">{helping} helping {helping === 1 ? "society" : "societies"} · coordinated by HQ</p>
      <Link className={`${linkClass} text-[12.5px]`} href={`/emergencies/${incidentId}?tab=actions`}>Response actions</Link>
    </>
  );
}

/** "Pahala Kosgama SSS ← Bingiriya SSS · 12 of 40" */
function actionLine(action: EmergencyResponseAction) {
  const target = action.forSociety?.name ?? "Society";
  if (!action.helpers.length) return `${target} · no helper yet`;
  const helpers = action.helpers.map((h) => h.society.name).join(", ");
  const progress = action.state === "IN_PROGRESS" ? ` · ${number(action.delivered)} of ${number(action.quantity)}` : "";
  return `${target} ← ${helpers}${progress}`;
}

/** V5 IR01 "Assigned by HQ": what is being done for the user's societies. */
export function ActionsSummary({ actions }: { actions: EmergencyResponseAction[] }) {
  return (
    <>
      {actions.length ? (
        <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
          {actions.slice(0, 5).map((action) => (
            <li className="flex items-start justify-between gap-3 py-2.5" key={action.id}>
              <span className="min-w-0 text-[12px] text-ink-soft">
                <strong className="block text-[13px] text-ink">{action.title} · {quantityLine(action.quantity, action.unit)}</strong>
                {actionLine(action)}
              </span>
              <ActionBadge state={action.state} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-ink-soft">No response actions for your societies yet.</p>
      )}
      <p className="text-[11.5px] text-ink-soft">Response actions and helping societies are assigned by HQ only. Needs and items or tasks only — no money or payments.</p>
    </>
  );
}

export function HistoryList({ history }: { history: EmergencyHistoryEntry[] }) {
  if (!history.length) return <p className="text-[12.5px] text-ink-soft">Nothing recorded yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {history.map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          <strong className="block text-[12.5px] text-ink">
            {HISTORY_LABELS[entry.action] ?? entry.action}
            {entry.societyName ? ` · ${entry.societyName}` : entry.action === "INCIDENT_OPENED" ? " · people covering the area notified" : ""}
          </strong>
          <span className="text-[11px] text-ink-soft">
            {entry.actorName ?? "Someone"}
            {entry.actorRole ? ` (${SHORT_ROLE[entry.actorRole] ?? entry.actorRole})` : ""} · {shortDateTime(entry.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const BOARD: EmergencyActionState[] = ["NEEDED", "ASSIGNED", "IN_PROGRESS", "DELIVERED"];

/** V5 D32 board: one column per state, a card per need. Badges and numbers, never bars. */
export function ActionsBoard({ actions, incidentId, canAssign }: { actions: EmergencyResponseAction[]; incidentId: string; canAssign: boolean }) {
  return (
    <div className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
      {BOARD.map((state) => {
        const cards = actions.filter((action) => action.state === state);
        return (
          <section aria-label={ACTION_STATE_LABELS[state]} className="flex flex-col gap-2.5 rounded-card bg-surface-muted p-2.5" key={state}>
            <h2 className="flex items-center justify-between px-1 text-[13px] font-bold text-ink">
              {ACTION_STATE_LABELS[state]} <span className="text-[12px] font-semibold text-ink-soft">{cards.length}</span>
            </h2>
            {cards.length ? (
              cards.map((action) => (
                <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3" key={action.id}>
                  <span className="w-fit rounded-pill bg-info-bg px-2 py-0.5 text-[10.5px] font-semibold text-info-text">{NEED_LABELS[action.need]}</span>
                  <strong className="text-[13px] text-ink">{action.forSociety?.name ?? "Society"}</strong>
                  <span className="text-[11.5px] text-ink-soft">
                    {quantityLine(action.quantity, action.unit)} {action.title === NEED_LABELS[action.need] ? "" : `${action.title} `}·{" "}
                    {action.helpers.length ? `helping: ${action.helpers.map((h) => h.society.name).join(", ")}` : "no helper yet"}
                  </span>
                  {action.helpers.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {action.helpers.map((helper) => (
                        <li className="flex items-center justify-between gap-2 text-[11.5px] text-ink" key={helper.id}>
                          <span>{helper.society.name} · {number(helper.deliveredQuantity)} of {number(helper.quantity)}</span>
                          <HelperBadge status={helper.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {action.dueAt && <span className="text-[11px] text-ink-soft">Deliver by {shortDateTime(action.dueAt)}</span>}
                  {canAssign && (
                    <Link
                      className="inline-flex h-9 w-fit items-center rounded-button bg-brand-action px-3.5 text-[12.5px] font-semibold text-white hover:bg-brand-action-pressed"
                      href={`/emergencies/${incidentId}?tab=actions&panel=assign&action=${action.id}`}
                    >
                      {action.helpers.length ? "Add helpers" : "Assign helpers"}
                    </Link>
                  )}
                </article>
              ))
            ) : (
              <p className="px-1 text-[12px] text-ink-soft">None</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * V5 D33 / M47: a numbered situation report, laid out for printing to PDF.
 * Counts only: no names of affected people or other personal details.
 */
export function SituationReportDocument({ report }: { report: EmergencySituationReport }) {
  const { snapshot, incident } = report;
  const t = snapshot.totals;
  const th = "px-3 py-2.5 text-left text-[11px] font-medium text-muted";
  const td = "px-3 py-3 text-[12.5px] text-ink";
  const asOf = shortDateTime(report.asOf);
  return (
    <article className="situation-report mx-auto flex w-full max-w-[840px] flex-col gap-4 rounded-card border border-line bg-surface px-6 py-8 md:px-10" id="situation-report">
      <header className="flex items-center gap-5 border-b-2 border-danger-dot pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="Sarvodaya Connect" className="h-10 w-auto" src="/brand/sarvodaya-connect-wordmark.png" />
        <div>
          <p className="text-[10.5px] font-bold tracking-[0.08em] text-danger-text">
            Situation Report No. {report.number} · As of {asOf}
          </p>
          <h2 className="text-[18px] font-bold text-ink">{incident.title} ({incident.reference})</h2>
          <p className="text-[12px] text-ink-soft">{areaLine(incident)}</p>
        </div>
      </header>
      <h3 className="text-[13px] font-bold text-ink">1. Summary</h3>
      <div className="grid items-stretch gap-3 sm:grid-cols-4">
        {[
          [number(t.affected), "societies affected"],
          [number(t.people), "people affected"],
          [`${number(t.housesFully)} / ${number(t.housesPartly)}`, "houses full / part"],
          [number(t.notAssessed), "not yet assessed"],
        ].map(([value, label]) => (
          <div className="rounded-lg border border-line px-3 py-2.5" key={label}>
            <strong className="block text-[16px] text-ink">{value}</strong>
            <span className="text-[11px] text-ink-soft">{label}</span>
          </div>
        ))}
      </div>
      {report.summary && <p className="whitespace-pre-wrap text-[12.5px] text-ink">{report.summary}</p>}
      <h3 className="text-[13px] font-bold text-ink">2. Affected Societies by District</h3>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-left">
          <thead className="bg-surface-muted">
            <tr>
              {["District", "In Area", "Affected", "Critical", "Families", "People", "Houses Full / Part", "Not Assessed"].map((h) => (
                <th className={th} key={h} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {snapshot.byDistrict.map((row) => (
              <tr key={row.districtId}>
                <td className={td}>{row.name}</td>
                <td className={td}>{number(row.inArea)}</td>
                <td className={td}>{number(row.affected)}</td>
                <td className={td}>{number(row.critical)}</td>
                <td className={td}>{number(row.families)}</td>
                <td className={td}>{number(row.people)}</td>
                <td className={td}>{number(row.housesFully)} / {number(row.housesPartly)}</td>
                <td className={td}>{number(row.notAssessed)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={td}>Total</td>
              <td className={td}>{number(t.societiesInArea)}</td>
              <td className={td}>{number(t.affected)}</td>
              <td className={td}>{number(t.critical)}</td>
              <td className={td}>{number(t.families)}</td>
              <td className={td}>{number(t.people)}</td>
              <td className={td}>{number(t.housesFully)} / {number(t.housesPartly)}</td>
              <td className={td}>{number(t.notAssessed)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3 className="text-[13px] font-bold text-ink">3. Response Actions</h3>
      {snapshot.items.length ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface-muted">
              <tr>
                {["Item", "Needed", "Delivered", "Helping societies"].map((h) => (
                  <th className={th} key={h} scope="col">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {snapshot.items.map((item) => (
                <tr key={`${item.need}-${item.title}-${item.unit}`}>
                  <td className={td}>{item.title}</td>
                  <td className={td}>{quantityLine(item.needed, item.unit)}</td>
                  <td className={td}>{quantityLine(item.delivered, item.unit)}</td>
                  <td className={td}>{item.helpingSocieties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-soft">No response actions yet.</p>
      )}
      <h3 className="text-[13px] font-bold text-ink">4. Gaps and Next Steps</h3>
      <p className="text-[12.5px] text-ink">
        {t.notAssessed
          ? `${number(t.notAssessed)} ${t.notAssessed === 1 ? "society has" : "societies have"} not sent an assessment.`
          : "Every society in the area has sent an assessment."}{" "}
        {snapshot.helpingSocieties} {snapshot.helpingSocieties === 1 ? "society is" : "societies are"} helping {snapshot.helpedSocieties} affected{" "}
        {snapshot.helpedSocieties === 1 ? "society" : "societies"}.
      </p>
      <p className="border-t border-line-soft pt-3 text-[11px] text-muted">Generated from Sarvodaya Connect · counts only, no personal details · made by {report.createdBy ?? "HQ"}</p>
    </article>
  );
}

/** A side panel over the page (D30, D32, IR03). Closing goes back to the page underneath. */
export function Drawer({ title, subtitle, closeHref, children }: { title: string; subtitle?: ReactNode; closeHref: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <Link aria-label="Close" className="absolute inset-0 bg-[#1b261f]/45" href={closeHref} />
      <aside aria-labelledby="drawer-heading" aria-modal="true" className="relative h-full w-full max-w-[560px] overflow-y-auto bg-surface px-6 py-5 shadow-2xl" role="dialog">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-ink" id="drawer-heading">{title}</h2>
            {subtitle && <p className="text-[12px] text-ink-soft">{subtitle}</p>}
          </div>
          <Link aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink hover:bg-brand-mint-soft" href={closeHref}>
            <Icon className="size-4" name="close" strokeWidth={2} />
          </Link>
        </div>
        {children}
      </aside>
    </div>
  );
}

/** A centred dialog over the page (IR02, IR04). */
export function Modal({ title, subtitle, closeHref, children }: { title: string; subtitle?: ReactNode; closeHref: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto px-4 py-8">
      <Link aria-label="Close" className="fixed inset-0 bg-[#1b261f]/45" href={closeHref} />
      <section aria-labelledby="modal-heading" aria-modal="true" className="relative w-full max-w-[560px] rounded-card bg-surface px-6 py-5 shadow-2xl" role="dialog">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-ink" id="modal-heading">{title}</h2>
            {subtitle && <p className="text-[12px] text-ink-soft">{subtitle}</p>}
          </div>
          <Link aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink hover:bg-brand-mint-soft" href={closeHref}>
            <Icon className="size-4" name="close" strokeWidth={2} />
          </Link>
        </div>
        {children}
      </section>
    </div>
  );
}

/** A one-line result after an action ("Incident opened", "Reminder sent"). */
export function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return tone === "success" ? (
    <p className="rounded-card border border-[#c6e2cd] bg-success-bg px-4 py-2.5 text-[12px] font-semibold text-success-text" role="status">{children}</p>
  ) : (
    <p className="rounded-card border border-[#efc4bd] bg-danger-bg px-4 py-2.5 text-[12px] font-semibold text-danger-text" role="alert">{children}</p>
  );
}

/** V5 IR01 rule banner: what every signed-in user may do here. */
export function RulesBanner() {
  return (
    <p className="flex items-center gap-2.5 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] px-3.5 py-2.5 text-[12.5px] text-[var(--banner-edit-text)]">
      <Icon className="size-4 shrink-0" name="shield" strokeWidth={2} />
      Everyone signed in can see live incidents for their societies, send rapid assessments, and open or close an incident. Only HQ assigns response actions.
    </p>
  );
}

