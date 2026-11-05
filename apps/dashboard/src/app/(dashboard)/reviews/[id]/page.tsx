import Link from "next/link";

import type { GradeHistoryEvent, GradeRequestDetail } from "@sarvodaya-connect/api-contracts";

import { SuccessState, primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { GradeBadge } from "@/components/dashboard/grade-queue/grade-badge";
import { GradeReviewDecision } from "@/components/dashboard/grade-queue/grade-review-decision";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getGradeRequestDetail } from "@/lib/society-record-api";
import { actorLabel, formatDate, SOCIETY_GRADE_LABELS, waitingLabel } from "@/lib/society-record-format";

import { decideFromQueue } from "../../societies/[id]/record-actions";

const dateTime = new Intl.DateTimeFormat("en-GB", {
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

function historyTitle(event: GradeHistoryEvent) {
  const change = event.fromGrade !== undefined ? `${event.fromGrade ?? "–"} → ${event.toGrade}` : "";
  switch (event.kind) {
    case "REQUESTED":
      return `${change} requested`;
    case "APPROVED":
      return `${change} approved`;
    case "REJECTED":
      return `${change} rejected`;
    case "CHANGED_BY_HQ":
      return `Changed directly by ${event.actor.displayName}`;
  }
}

function Decided({ request }: { request: GradeRequestDetail }) {
  const approved = request.status === "APPROVED";
  return (
    <section className="rounded-card border border-line bg-surface">
      <SuccessState
        action={<Link className={primaryButtonClass} href="/reviews">Back to queue</Link>}
        description={`${approved ? "Approved" : "Rejected"} by ${request.decidedBy?.displayName ?? "HQ"}${
          request.decidedAt ? ` on ${formatDate(request.decidedAt)}` : ""
        }.${request.decisionComment ? ` “${request.decisionComment}”` : ""} The requester has been told.`}
        title={approved ? `Grade ${request.toGrade} approved` : `Request rejected · grade stays ${request.fromGrade ?? "not set"}`}
      />
    </section>
  );
}

/** V5 D22r: HQ reviews one grade-change request. */
export default async function GradeRequestPage({ params, searchParams }: PageProps<"/reviews/[id]">) {
  await getCurrentViewer();
  const { id } = await params;
  const { decided } = await searchParams;
  const request = await getGradeRequestDetail(id);
  const { society } = request;
  const base = `/societies/${society.id}`;
  const waiting = request.status === "PENDING";

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="flex gap-1.5 text-[11.5px] text-ink-soft">
        <Link className="font-medium text-brand-action underline underline-offset-2" href="/reviews">Grade requests</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{society.name}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-ink">
            Grade Change {request.fromGrade ?? "–"} → {request.toGrade} · {society.name}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {society.societyCode} · {society.district} · sent by {actorLabel(request.requestedBy)} on{" "}
            {dateTime.format(new Date(request.requestedAt))}
            {waiting && ` · waiting ${waitingLabel(request.requestedAt)}`}
          </p>
        </div>
        {waiting ? (
          <span className="rounded-md bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn-text">● Waiting for HQ</span>
        ) : (
          <span className="rounded-md bg-state-grey px-2 py-0.5 text-[11px] font-semibold text-ink-soft">● Decided</span>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card title="Request">
            <div className="flex items-center gap-3">
              <GradeBadge grade={request.fromGrade} size="lg" />
              <span aria-hidden="true" className="text-ink-soft">→</span>
              <GradeBadge grade={request.toGrade} size="lg" />
              <div className="ml-2">
                <strong className="block text-[13px] text-ink">
                  From {request.fromGrade ? SOCIETY_GRADE_LABELS[request.fromGrade] : "no grade"} to {SOCIETY_GRADE_LABELS[request.toGrade]}
                </strong>
                {society.gradeChangedAt && (
                  <span className="text-[11.5px] text-ink-soft">Current grade set {formatDate(society.gradeChangedAt)}</span>
                )}
              </div>
            </div>
            <p className="mt-4 text-[12px] text-ink-soft">Reason given</p>
            <blockquote className="mt-1 rounded-lg bg-surface-muted px-3.5 py-3 text-[13px] text-ink">“{request.reason}”</blockquote>
          </Card>

          <Card title="Society at a Glance">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Members", society.memberCount === null ? "—" : society.memberCount.toLocaleString("en-GB")],
                ["Exco members", `${society.excoMembers} / 25`],
                [society.planYear ? `${society.planYear} plan` : "Work plan", `${society.planActivities} ${society.planActivities === 1 ? "activity" : "activities"}`],
                ["Last update", formatDate(society.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-ink-soft">{label}</dt>
                  <dd className="text-[17px] font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px]">
              {[
                ["Open society record", base],
                ["Exco", `${base}/exco`],
                ["Work Plan", `${base}/work-plan`],
                ["Documents", `${base}/documents`],
              ].map(([label, href], index) => (
                <span key={href}>
                  {index > 0 && " · "}
                  <Link className="font-medium text-brand-action underline underline-offset-2" href={href!}>{label}</Link>
                </span>
              ))}
            </p>
          </Card>

          <Card title="Grade History">
            {request.history.length ? (
              <ol className="space-y-3">
                {request.history.map((event) => (
                  <li className="flex gap-3" key={event.id}>
                    <span aria-hidden="true" className={`mt-1 size-3.5 shrink-0 rounded-[3px] border-2 ${HISTORY_TONE[event.kind]}`} />
                    <div>
                      <strong className="block text-[13px] text-ink">{historyTitle(event)}</strong>
                      <span className="text-[11.5px] text-ink-soft">
                        {actorLabel(event.actor)} · {formatDate(event.at)}
                        {event.note && event.kind !== "REQUESTED" ? ` · “${event.note}”` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[12px] text-ink-soft">No grade changes recorded yet.</p>
            )}
          </Card>
        </div>

        {waiting ? (
          <GradeReviewDecision decide={decideFromQueue.bind(null, society.id, request.id)} request={request} />
        ) : decided ? (
          <Decided request={request} />
        ) : (
          <section className="rounded-card border border-line bg-surface p-5 text-[13px]">
            <h2 className="text-[16px] font-bold text-ink">Decision</h2>
            <p className="mt-2">
              {request.status === "APPROVED" ? "Approved" : "Rejected"} by {request.decidedBy?.displayName ?? "HQ"}
              {request.decidedAt ? ` on ${formatDate(request.decidedAt)}` : ""}.
            </p>
            {request.decisionComment && <p className="mt-1 text-ink-soft">“{request.decisionComment}”</p>}
            <Link className={`${secondaryButtonClass} mt-4`} href="/reviews">Back to queue</Link>
          </section>
        )}
      </div>
    </div>
  );
}
