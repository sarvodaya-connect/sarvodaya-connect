import Link from "next/link";

import type {
  EmergencyHelpingCandidate,
  EmergencyIncidentDetail,
  EmergencySituationReport,
  EmergencySocietyPage,
} from "@sarvodaya-connect/api-contracts";

import { NoAccessState, primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { AddNeedForm, AssessmentWizard, AssignHelpersForm, PrintReportButton, ReportPicker } from "@/components/dashboard/emergencies/incident-forms";
import {
  ActionsBoard,
  ActionsSummary,
  AssessmentsTable,
  Breadcrumb,
  ByDistrictTable,
  Card,
  Drawer,
  HistoryList,
  IncidentHeader,
  IncidentTabs,
  IncidentTiles,
  Modal,
  Notice,
  RulesBanner,
  SituationReportDocument,
  SocietiesHelping,
  UrgentNeeds,
} from "@/components/dashboard/emergencies/incident-view";
import { Icon } from "@/components/dashboard/icon";
import { SHORT_ROLE_LABELS } from "@/lib/access";
import { getDesktopViewer } from "@/lib/current-viewer";
import { failureMessage, getHelpingCandidates, getIncident, getIncidentSocieties, getSituationReport, isNotFound } from "@/lib/emergency-api";
import { incidentTab, isUuid, NEED_LABELS, quantityLine } from "@/lib/emergency-format";
import { shortDateTime } from "@/lib/home-format";

import {
  addNeed,
  assignHelpers,
  closeIncident,
  completeEvidenceUpload,
  createSituationReport,
  sendAssessment,
  sendReminders,
  startEvidenceUpload,
} from "../actions";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const STATES = [
  ["ALL", "All"],
  ["NOT_ASSESSED", "Not assessed"],
  ["CRITICAL", "Critical"],
  ["AFFECTED", "Affected"],
  ["SAFE", "Safe"],
] as const;

const dangerOutline =
  "inline-flex h-[38px] items-center justify-center rounded-button border border-[var(--banner-incident-line)] bg-surface px-4 text-[13px] font-semibold text-danger-text hover:bg-danger-bg";

/**
 * V5 D31 (HQ) and IR01 (SPC, DDM, DM): a live incident, with the tabs D31–D33
 * and the panels IR03 (`?panel=assess`), IR04 (`?panel=close`), D32
 * (`?panel=assign&action=<id>`, `?panel=need`). The API returns only what the
 * user's scope covers and says what they may do.
 */
export default async function IncidentPage({ params, searchParams }: PageProps<"/emergencies/[id]">) {
  const viewer = await getDesktopViewer();
  const { id } = await params;
  const query = await searchParams;
  const tab = incidentTab(first(query.tab));
  const panel = first(query.panel);
  const now = new Date();
  const back = <Link className={secondaryButtonClass} href="/emergencies">Back to disaster response</Link>;
  if (!isUuid(id)) return <NoAccessState action={back} description="This incident could not be found, or it does not cover your societies." heading="h1" title="You don’t have access to this incident" />;

  let detail: EmergencyIncidentDetail;
  try {
    detail = await getIncident(id);
  } catch (error) {
    if (isNotFound(error)) {
      return <NoAccessState action={back} description="This incident could not be found, or it does not cover your societies." heading="h1" title="You don’t have access to this incident" />;
    }
    return (
      <section className="rounded-card border border-[#efc4bd] bg-surface p-6" role="alert">
        <h1 className="text-[15px] font-bold text-ink">We couldn’t load this incident</h1>
        <p className="mt-1 text-[12.5px] text-ink-soft">{failureMessage(error)}</p>
        <Link className="mt-3 inline-block text-[12.5px] font-semibold text-brand-forest underline underline-offset-2" href={`/emergencies/${id}`}>Try again</Link>
      </section>
    );
  }
  const { incident, permissions, totals } = detail;
  const isHq = viewer.role === "HQ_ADMIN";
  const base = `/emergencies/${id}`;
  const tabHref = tab === "overview" ? base : `${base}?tab=${tab}`;

  const state = STATES.some(([value]) => value === first(query.state)) ? first(query.state)! : "ALL";
  const page = Math.max(1, Math.min(1000, Number(first(query.page)) || 1));
  const reportId = first(query.report);
  const actionId = first(query.action);
  const [societies, report, candidates] = await Promise.all([
    tab === "assessments" ? getIncidentSocieties(id, state, page).catch(() => null) : Promise.resolve<EmergencySocietyPage | null>(null),
    tab === "reports" && detail.reports.length
      ? getSituationReport(isUuid(reportId) ? reportId : detail.reports[0]!.id).catch(() => null)
      : Promise.resolve<EmergencySituationReport | null>(null),
    panel === "assign" && isUuid(actionId) && permissions.canAssign ? getHelpingCandidates(actionId).catch(() => null) : Promise.resolve<EmergencyHelpingCandidate[] | null>(null),
  ]);
  const need = detail.actions.find((action) => action.id === actionId);

  const headerActions = (
    <>
      {isHq ? (
        <Link className={secondaryButtonClass} href={`${base}?tab=reports`}>
          <Icon className="size-4" name="document" strokeWidth={2} />
          Situation report
        </Link>
      ) : (
        permissions.canAssess && (
          <Link className={primaryButtonClass} href={`${tabHref}${tab === "overview" ? "?" : "&"}panel=assess`}>
            <Icon className="size-4" name="clipboard" strokeWidth={2} />
            Submit rapid assessment
          </Link>
        )
      )}
      {permissions.canClose && <Link className={dangerOutline} href={`${tabHref}${tab === "overview" ? "?" : "&"}panel=close`}>Close incident</Link>}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb incident={incident} page={tab === "actions" ? "Response actions" : tab === "reports" ? "Situation reports" : tab === "assessments" ? "Assessments" : undefined} />
      <IncidentHeader actions={headerActions} incident={incident} now={now} />
      {!isHq && <RulesBanner />}

      {first(query.opened) && <Notice tone="success">Incident opened. The people covering the area have been notified.</Notice>}
      {first(query.closed) && <Notice tone="success">Incident closed. Your name and the time are in the incident history.</Notice>}
      {first(query.closeFailed) && <Notice tone="error">The incident could not be closed. It may be closed already. Refresh and try again.</Notice>}
      {first(query.reminded) && <Notice tone="success">Reminder sent to the people looking after societies that have not sent an assessment.</Notice>}
      {first(query.remindFailed) && <Notice tone="error">The reminder could not be sent. Try again.</Notice>}
      {first(query.added) && <Notice tone="success">Need added. Assign the societies that will help.</Notice>}
      {first(query.assigned) && <Notice tone="success">Helping societies assigned and notified.</Notice>}
      {first(query.reportFailed) && <Notice tone="error">The situation report could not be made. Try again.</Notice>}

      <IncidentTabs counts={{ assessments: totals.assessed, actions: totals.actions, reports: detail.reports.length }} current={tab} incidentId={id} />

      {tab === "overview" && (
        <>
          <IncidentTiles totals={totals} />
          <div className="grid items-stretch gap-4 lg:grid-cols-[1.7fr_1fr]">
            <Card
              action={<Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href={`${base}?tab=assessments`}>All {totals.assessed}</Link>}
              eyebrow="Assessments"
              id="assessments-heading"
              title="Rapid assessments received"
            >
              <AssessmentsTable
                emptyText={isHq ? "No assessments received yet." : "No assessments received yet for your societies."}
                incidentId={id}
                rows={detail.recentAssessments}
                wide={isHq}
              />
            </Card>
            <div className="flex min-w-0 flex-col gap-4">
              {isHq ? (
                <>
                  <Card eyebrow="Area" id="district-heading" title="By district">
                    <ByDistrictTable totals={totals} />
                  </Card>
                  <Card eyebrow="From assessments" id="needs-heading" title="Urgent needs">
                    <UrgentNeeds totals={totals} />
                  </Card>
                  <Card eyebrow="Coordination" id="helping-heading" title="Societies helping">
                    <SocietiesHelping actions={detail.actions} incidentId={id} />
                  </Card>
                </>
              ) : (
                <>
                  <Card
                    action={
                      <span className="inline-flex items-center gap-1 rounded-pill bg-brand-forest px-2 py-0.5 text-[10.5px] font-semibold text-white">
                        <Icon className="size-3" name="lock" strokeWidth={2.2} />
                        HQ decides
                      </span>
                    }
                    eyebrow="Response actions"
                    id="actions-heading"
                    title="Assigned by HQ"
                  >
                    <ActionsSummary actions={detail.actions} />
                  </Card>
                  <Card eyebrow="History" id="history-heading" title="Incident history">
                    <HistoryList history={detail.history} />
                  </Card>
                </>
              )}
            </div>
          </div>
          {isHq && (
            <Card eyebrow="History" id="history-heading" title="Incident history">
              <HistoryList history={detail.history} />
            </Card>
          )}
        </>
      )}

      {tab === "assessments" && (
        <section aria-labelledby="all-assessments" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">Assessments</p>
              <h2 className="text-[15px] font-bold text-ink" id="all-assessments">
                {isHq ? `Societies in the area (${totals.societiesInArea})` : "Your societies in the area"}
              </h2>
              <p className="text-[12px] text-ink-soft">{totals.assessed} assessed · {totals.notAssessed} not yet assessed{detail.lastReminderAt ? ` · last reminder ${shortDateTime(detail.lastReminderAt)}` : ""}</p>
            </div>
            {permissions.canReport && incident.status !== "CLOSED" && totals.notAssessed > 0 && (
              <form action={sendReminders}>
                <input name="incidentId" type="hidden" value={id} />
                <button className={secondaryButtonClass} type="submit">
                  <Icon className="size-4" name="bell" strokeWidth={2} />
                  Remind {totals.notAssessed} {totals.notAssessed === 1 ? "society" : "societies"}
                </button>
              </form>
            )}
          </div>
          <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
            {STATES.map(([value, label]) => (
              <Link
                aria-current={value === state ? "page" : undefined}
                className={`rounded-pill border px-3 py-1 text-[12px] font-semibold ${value === state ? "border-brand-forest bg-brand-forest text-white" : "border-line text-ink hover:bg-brand-mint-soft"}`}
                href={`${base}?tab=assessments${value === "ALL" ? "" : `&state=${value}`}`}
                key={value}
              >
                {label}
              </Link>
            ))}
          </nav>
          {societies ? (
            <>
              <AssessmentsTable emptyText="No societies match this filter." incidentId={id} rows={societies.data} wide />
              {societies.meta.totalPages > 1 && (
                <nav aria-label="Pages" className="flex items-center justify-between text-[12px] text-ink-soft">
                  <span>Page {societies.meta.page} of {societies.meta.totalPages} · {societies.meta.totalItems} societies</span>
                  <span className="flex gap-2">
                    {page > 1 && <Link className={secondaryButtonClass} href={`${base}?tab=assessments&state=${state}&page=${page - 1}`}>Previous</Link>}
                    {page < societies.meta.totalPages && <Link className={secondaryButtonClass} href={`${base}?tab=assessments&state=${state}&page=${page + 1}`}>Next</Link>}
                  </span>
                </nav>
              )}
            </>
          ) : (
            <Notice tone="error">The societies could not be loaded. Refresh the page to try again.</Notice>
          )}
        </section>
      )}

      {tab === "actions" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex flex-1 items-start gap-2.5 rounded-xl border border-[var(--warn-ring)] bg-warn-bg px-3.5 py-2.5 text-[12px] text-warn-text">
              <Icon className="mt-0.5 size-4 shrink-0" name="help" />
              <span>
                <strong className="block">Needs and items or tasks only.</strong>
                Response actions record what is needed, who helps and what is delivered — no money, payments, prices or contributions.
                {!isHq && " Only HQ assigns them; the helping society updates its delivery on the phone."}
              </span>
            </p>
            {permissions.canAssign && (
              <Link className={primaryButtonClass} href={`${base}?tab=actions&panel=need`}>
                <Icon className="size-4" name="list" strokeWidth={2} />
                Add a need
              </Link>
            )}
          </div>
          <ActionsBoard actions={detail.actions} canAssign={permissions.canAssign} incidentId={id} />
        </>
      )}

      {tab === "reports" && (
        <>
          <div className="flex flex-wrap items-end gap-2.5 print:hidden">
            {detail.reports.length > 0 && (
              <ReportPicker
                current={report?.id}
                incidentId={id}
                reports={detail.reports.map((r) => ({ ...r, label: shortDateTime(r.asOf) }))}
              />
            )}
            {permissions.canReport && (
              <form action={createSituationReport} className="flex flex-wrap items-end gap-2.5">
                <input name="incidentId" type="hidden" value={id} />
                <label className="text-[12px] font-semibold text-ink">
                  Summary (optional)
                  <input
                    className="mt-1 block w-[320px] max-w-full rounded-input border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink"
                    maxLength={4000}
                    name="summary"
                    placeholder="What has happened since the last report"
                    type="text"
                  />
                </label>
                <button className={secondaryButtonClass} type="submit">
                  <Icon className="size-4" name="refresh" strokeWidth={2} />
                  {detail.reports.length ? "Refresh from latest data" : "Make the first report"}
                </button>
              </form>
            )}
            {report && <PrintReportButton />}
          </div>
          {report ? (
            <SituationReportDocument report={report} />
          ) : detail.reports.length ? (
            <Notice tone="error">This situation report could not be loaded. Refresh the page to try again.</Notice>
          ) : (
            <section className="rounded-card border border-line bg-surface p-8 text-center" role="status">
              <h2 className="text-[15px] font-bold text-ink">No situation reports yet</h2>
              <p className="mt-1 text-[12.5px] text-ink-soft">
                {permissions.canReport ? "Make the first report from the latest assessments and response actions." : "HQ makes situation reports from the latest assessments. They appear here."}
              </p>
            </section>
          )}
        </>
      )}

      {panel === "assess" && permissions.canAssess && (
        <Drawer closeHref={tabHref} subtitle={`${incident.reference} · ${incident.title}`} title="Rapid assessment">
          <AssessmentWizard
            closeHref={tabHref}
            completeUpload={completeEvidenceUpload}
            incident={incident}
            initialSocietyId={first(query.society)}
            send={sendAssessment}
            societies={detail.assessableSocieties}
            startUpload={startEvidenceUpload}
          />
        </Drawer>
      )}

      {panel === "close" && permissions.canClose && (
        <Modal closeHref={tabHref} title={`Close ${incident.reference}?`}>
          <form action={closeIncident} className="flex flex-col gap-4">
            <input name="incidentId" type="hidden" value={id} />
            <p className="text-[13px] text-ink">
              {incident.title} · opened {shortDateTime(incident.openedAt)} by {incident.openedBy.name ?? "someone"}.
            </p>
            <p className="flex gap-2.5 rounded-xl border border-[var(--warn-ring)] bg-warn-bg px-3.5 py-2.5 text-[12px] text-warn-text">
              <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
              <span>
                <strong className="block">After closing</strong>
                The people covering the area are told the incident is closed. New assessments, needs and delivery updates are no longer accepted.
              </span>
            </p>
            <p className="text-[12px] text-ink-soft">Your name ({viewer.displayName}, {SHORT_ROLE_LABELS[viewer.role]}) and the time are recorded in the incident history.</p>
            <div className="flex justify-end gap-2.5">
              <Link className={secondaryButtonClass} href={tabHref}>Keep open</Link>
              <button className="inline-flex h-[38px] items-center rounded-button bg-danger-dot px-4 text-[13px] font-semibold text-white hover:bg-danger-text" type="submit">
                Close incident
              </button>
            </div>
          </form>
        </Modal>
      )}

      {panel === "assign" && permissions.canAssign && (
        <Drawer
          closeHref={`${base}?tab=actions`}
          subtitle={need ? `Need: ${NEED_LABELS[need.need].toLowerCase()} · ${quantityLine(need.quantity, need.unit)} · for ${need.forSociety?.name ?? "a society"} (${need.forSociety?.districtName ?? ""})` : undefined}
          title="Assign helping societies"
        >
          {need && candidates ? (
            <AssignHelpersForm action={assignHelpers} candidates={candidates} incidentId={id} need={need} now={now} />
          ) : (
            <Notice tone="error">This need could not be found. Go back to response actions and try again.</Notice>
          )}
        </Drawer>
      )}

      {panel === "need" && permissions.canAssign && (
        <Drawer closeHref={`${base}?tab=actions`} subtitle={`${incident.reference} · ${incident.title}`} title="Add a need">
          <AddNeedForm action={addNeed} incidentId={id} societies={detail.assessableSocieties} />
        </Drawer>
      )}
    </div>
  );
}
