import Link from "next/link";

import type { GradeHistoryEvent, GradeRequestDetail } from "@sarvodaya-connect/api-contracts";

import { SuccessState, primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { GradeBadge } from "@/components/dashboard/grade-queue/grade-badge";
import { GradeReviewDecision } from "@/components/dashboard/grade-queue/grade-review-decision";
import { getT } from "@/i18n/server";
import { actorName, gradeName, recordDate, waiting as waitingFor } from "@/i18n/society-record";
import { formatDate, formatNumber, type Translator } from "@/i18n/translate";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getGradeRequestDetail } from "@/lib/society-record-api";

import { decideFromQueue } from "../../societies/[id]/record-actions";

const dateTime = (t: Translator, value: string) =>
  formatDate(t.locale, new Date(value), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Colombo",
  });

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-[16px] font-bold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const HISTORY_TONE: Record<GradeHistoryEvent["kind"], string> = {
  REQUESTED: "border-[#e07b2f]",
  APPROVED: "border-ink",
  REJECTED: "border-danger-dot",
  CHANGED_BY_HQ: "border-ink",
};

function historyTitle(t: Translator, event: GradeHistoryEvent) {
  const change = event.fromGrade !== undefined ? `${event.fromGrade ?? "–"} → ${event.toGrade}` : "";
  switch (event.kind) {
    case "REQUESTED":
      return t("sr.r.requested", { change });
    case "APPROVED":
      return t("sr.r.approved", { change });
    case "REJECTED":
      return t("sr.r.rejected", { change });
    case "CHANGED_BY_HQ":
      return t("sr.r.changedBy", { name: event.actor.displayName });
  }
}

/** "Approved by R. Perera on 22 Oct 2026." */
function decidedLine(t: Translator, request: GradeRequestDetail) {
  const approved = request.status === "APPROVED";
  const name = request.decidedBy?.displayName ?? "HQ";
  return request.decidedAt
    ? t(approved ? "sr.r.approvedByOn" : "sr.r.rejectedByOn", { name, date: recordDate(t, request.decidedAt) })
    : t(approved ? "sr.r.approvedBy" : "sr.r.rejectedBy", { name });
}

function Decided({ request, t }: { request: GradeRequestDetail; t: Translator }) {
  const approved = request.status === "APPROVED";
  return (
    <section className="rounded-card border border-line bg-surface">
      <SuccessState
        action={<Link className={primaryButtonClass} href="/reviews">{t("sr.r.backToQueue")}</Link>}
        description={[decidedLine(t, request), request.decisionComment && `“${request.decisionComment}”`, t("sr.r.told")]
          .filter(Boolean)
          .join(" ")}
        title={
          approved
            ? t("sr.r.gradeApproved", { grade: request.toGrade })
            : t("sr.r.rejectedStays", { grade: request.fromGrade ?? t("sr.notSet") })
        }
      />
    </section>
  );
}

/** V5 D22r: HQ reviews one grade-change request. */
export default async function GradeRequestPage({ params, searchParams }: PageProps<"/reviews/[id]">) {
  const [, t] = await Promise.all([getCurrentViewer(), getT()]);
  const { id } = await params;
  const { decided } = await searchParams;
  const request = await getGradeRequestDetail(id);
  const { society } = request;
  const base = `/societies/${society.id}`;
  const waiting = request.status === "PENDING";

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("sr.breadcrumb")} className="flex gap-1.5 text-[11.5px] text-ink-soft">
        <Link className="font-medium text-brand-action underline underline-offset-2" href="/reviews">{t("sr.r.crumb")}</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{society.name}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-ink">
            {t("sr.r.title", { from: request.fromGrade ?? "–", to: request.toGrade, society: society.name })}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {t(waiting ? "sr.r.sentByWaiting" : "sr.r.sentBy", {
              code: society.societyCode,
              district: society.district,
              actor: actorName(t, request.requestedBy),
              date: dateTime(t, request.requestedAt),
              waiting: waitingFor(t, request.requestedAt),
            })}
          </p>
        </div>
        {waiting ? (
          <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn-text">● {t("sr.q.waitingHq")}</span>
        ) : (
          <span className="rounded-md bg-state-grey px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{t("sr.r.decided")}</span>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card title={t("sr.r.requestCard")}>
            <div className="flex items-center gap-3">
              <GradeBadge grade={request.fromGrade} size="lg" />
              <span aria-hidden="true" className="text-ink-soft">→</span>
              <GradeBadge grade={request.toGrade} size="lg" />
              <div className="ml-2">
                <strong className="block text-[13px] text-ink">
                  {t("sr.r.fromTo", {
                    from: request.fromGrade ? gradeName(t, request.fromGrade) : t("sr.r.noGrade"),
                    to: gradeName(t, request.toGrade),
                  })}
                </strong>
                {society.gradeChangedAt && (
                  <span className="text-[11.5px] text-ink-soft">{t("sr.r.currentSet", { date: recordDate(t, society.gradeChangedAt) })}</span>
                )}
              </div>
            </div>
            <p className="mt-4 text-[12px] text-ink-soft">{t("sr.r.reasonGiven")}</p>
            <blockquote className="mt-1 rounded-lg bg-surface-muted px-3.5 py-3 text-[13px] text-ink">“{request.reason}”</blockquote>
          </Card>

          <Card title={t("sr.r.glance")}>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                [t("sr.r.members"), society.memberCount === null ? "—" : formatNumber(t.locale, society.memberCount)],
                [t("sr.r.excoMembers"), `${society.excoMembers} / 25`],
                [society.planYear ? t("sr.r.planYear", { year: society.planYear }) : t("sr.r.workPlan"), t.plural("sr.r.activities", society.planActivities)],
                [t("sr.r.lastUpdate"), recordDate(t, society.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-ink-soft">{label}</dt>
                  <dd className="text-[17px] font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px]">
              {[
                [t("sr.r.openRecord"), base],
                ["Exco", `${base}/exco`],
                [t("sr.tab.workPlan"), `${base}/work-plan`],
                [t("nav.documents"), `${base}/documents`],
              ].map(([label, href], index) => (
                <span key={href}>
                  {index > 0 && " · "}
                  <Link className="font-medium text-brand-action underline underline-offset-2" href={href!}>{label}</Link>
                </span>
              ))}
            </p>
          </Card>

          <Card title={t("sr.r.gradeHistory")}>
            {request.history.length ? (
              <ol className="space-y-3">
                {request.history.map((event) => (
                  <li className="flex gap-3" key={event.id}>
                    <span aria-hidden="true" className={`mt-1 size-3.5 shrink-0 rounded-[3px] border-2 ${HISTORY_TONE[event.kind]}`} />
                    <div>
                      <strong className="block text-[13px] text-ink">{historyTitle(t, event)}</strong>
                      <span className="text-[11.5px] text-ink-soft">
                        {actorName(t, event.actor)} · {recordDate(t, event.at)}
                        {event.note && event.kind !== "REQUESTED" ? ` · “${event.note}”` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[12px] text-ink-soft">{t("sr.r.noHistory")}</p>
            )}
          </Card>
        </div>

        {waiting ? (
          <GradeReviewDecision decide={decideFromQueue.bind(null, society.id, request.id)} request={request} />
        ) : decided ? (
          <Decided request={request} t={t} />
        ) : (
          <section className="rounded-card border border-line bg-surface p-5 text-[13px]">
            <h2 className="text-[16px] font-bold text-ink">{t("sr.r.decision")}</h2>
            <p className="mt-2">{decidedLine(t, request)}</p>
            {request.decisionComment && <p className="mt-1 text-ink-soft">“{request.decisionComment}”</p>}
            <Link className={`${secondaryButtonClass} mt-4`} href="/reviews">{t("sr.r.backToQueue")}</Link>
          </section>
        )}
      </div>
    </div>
  );
}
