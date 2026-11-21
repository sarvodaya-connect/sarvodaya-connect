import Link from "next/link";

import { ActivityDetails } from "@/components/dashboard/activities/activity-details";
import { DevelopmentGoals } from "@/components/dashboard/activities/development-goals";
import { ActivityReview } from "@/components/dashboard/activities/activity-review";
import { ApprovalRuleNotice } from "@/components/dashboard/activities/approval-notice";
import { NoAccessState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Pill } from "@/components/dashboard/ui/pill";
import { getT } from "@/i18n/server";
import { asSpc, getActivity } from "@/lib/activities-api";
import { ROLE_LABELS } from "@/lib/society-record-format";

import { approveActivity, sendBackActivity } from "../actions";

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" });
const dayFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Colombo" });

function sentAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const today = dayFormatter.format(new Date()) === dayFormatter.format(date);
  return ` · ${today ? "today" : dayFormatter.format(date)} ${timeFormatter.format(date)}`;
}

/** V5 SP07: review one activity, choose its UN SDGs and approve or send it back. */
export default async function ReviewActivityPage({ params }: PageProps<"/activities-to-approve/[id]">) {
  const { id } = await params;
  const [activity, t] = await Promise.all([getActivity(id, asSpc()), getT()]);
  const officer = activity.createdBy;
  const heading = (
    <div>
      <h1 className="text-[22px] font-bold text-ink">{activity.name}</h1>
      <p className="text-[12px] text-ink-soft">
        {activity.society.name}
        {officer ? ` · sent by ${officer.displayName}${officer.role ? ` (${ROLE_LABELS[officer.role]})` : ""}` : ""}
        {sentAt(activity.submittedAt)}
      </p>
    </div>
  );

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-ink-soft">
      <Link className="text-brand-forest underline underline-offset-2" href="/activities-to-approve">Activities to Approve</Link>
      <span aria-hidden>›</span>
      <span aria-current="page">{activity.name}</span>
    </nav>
  );

  if (activity.status !== "WAITING_FOR_SPC" || !activity.permissions.canReview) {
    const decided = activity.status === "APPROVED" ? "approved" : activity.status === "SENT_BACK" ? "sent back" : null;
    return (
      <>
        {breadcrumb}
        <div className="mt-3">{heading}</div>
        {decided ? (
          <section className="mt-4 rounded-card border border-line bg-surface p-4" role="status">
            <Pill tone={activity.status === "APPROVED" ? "verified" : "returned"}>
              {activity.status === "APPROVED" ? "Approved" : "Sent back"}
            </Pill>
            <p className="mt-2 text-[12px] text-ink-soft">
              This activity was {decided}
              {activity.review ? ` by ${activity.review.by.displayName}` : ""}. It is no longer waiting for you.
            </p>
            {activity.review?.comment && <p className="mt-2 text-[12px] text-ink">“{activity.review.comment}”</p>}
          </section>
        ) : (
          <section className="mt-4 rounded-card border border-line bg-surface">
            <NoAccessState
              action={<Link className={secondaryButtonClass} href="/activities-to-approve">Back to Activities</Link>}
              description="Only the society’s SPC approves its activities."
              title="You Can’t Approve This Activity"
            />
          </section>
        )}
        <ActivityDetails activity={activity} />
        <DevelopmentGoals activity={activity} t={t} />
      </>
    );
  }

  return (
    <>
      {breadcrumb}
      <div className="mt-3">
        <ApprovalRuleNotice />
      </div>
      <div className="mt-4">
        <ActivityReview
          actions={{ approve: approveActivity.bind(null, activity.id), sendBack: sendBackActivity.bind(null, activity.id) }}
          details={<ActivityDetails activity={activity} />}
          heading={heading}
          officerName={officer?.displayName ?? "the Society Officer"}
        />
      </div>
    </>
  );
}
