import Link from "next/link";

import type { ActivityDetail } from "@/lib/activities-api";

import { ActivityReview } from "@/components/dashboard/activities/activity-review";
import { ApprovalRuleNotice } from "@/components/dashboard/activities/approval-notice";
import { NoAccessState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { SdgChips } from "@/components/dashboard/sdg/sdg-chip";
import { Pill } from "@/components/dashboard/ui/pill";
import { getActivity } from "@/lib/activities-api";
import { DIMENSION_LABELS, whenLabel } from "@/lib/activity-format";
import { formatLkr, ROLE_LABELS } from "@/lib/society-record-format";

import { approveActivity, sendBackActivity } from "../actions";

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" });
const dayFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Colombo" });

function sentAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const today = dayFormatter.format(new Date()) === dayFormatter.format(date);
  return ` · ${today ? "today" : dayFormatter.format(date)} ${timeFormatter.format(date)}`;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink">{value ?? "—"}</dd>
    </div>
  );
}

const PEOPLE: { key: keyof ActivityDetail; label: string; note: string }[] = [
  { key: "femaleParticipants", label: "Female participants", note: "Members and volunteers" },
  { key: "maleParticipants", label: "Male participants", note: "Members and volunteers" },
  { key: "youthParticipants", label: "Youth (15–25)", note: "Included above" },
  { key: "householdsBenefited", label: "Households benefited", note: "Families using the result" },
  { key: "womenHeadedHouseholds", label: "Women-headed households", note: "Of the households above" },
];

function ActivityDetails({ activity }: { activity: ActivityDetail }) {
  return (
    <section aria-labelledby="details-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">1 · From the Society Officer</p>
          <h2 className="text-[15px] font-bold text-ink" id="details-heading">Activity details</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1ec] px-2.5 py-0.5 text-[10px] font-semibold text-ink-soft">
          <Icon className="size-3" name="lock" /> View only
        </span>
      </div>
      <p className="mt-3 text-[13px] text-ink">{activity.description}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="When" value={whenLabel(activity)} />
        <Field label="Sector" value={activity.sector} />
        <Field label="Dimension" value={activity.dimension ? DIMENSION_LABELS[activity.dimension] : undefined} />
        <Field label="Allocated cost" value={`${formatLkr(activity.allocatedCost)} · planning`} />
        <Field label="Partners" value={activity.partners} />
        <Field label="Volunteer hours" value={activity.volunteerHours} />
      </dl>
      {activity.resourcesNeeded && (
        <dl className="mt-4">
          <Field label="Resources needed" value={activity.resourcesNeeded} />
        </dl>
      )}
      <h3 className="mt-5 border-t border-line-soft pt-4 text-[13px] font-bold text-ink">Participants and beneficiaries</h3>
      <ul className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PEOPLE.map(({ key, label, note }) => (
          <li className="flex h-full flex-col rounded-lg border border-line px-3 py-2.5" key={key}>
            <span className="text-[11px] text-ink-soft">{label}</span>
            <span className="text-[22px] font-bold text-ink">{(activity[key] as number | undefined) ?? "—"}</span>
            <span className="mt-auto text-[10px] text-muted">{note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** V5 SP07: review one activity, choose its UN SDGs and approve or send it back. */
export default async function ReviewActivityPage({ params }: PageProps<"/activities-to-approve/[id]">) {
  const { id } = await params;
  const activity = await getActivity(id);
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
      <Link className="text-brand-forest underline underline-offset-2" href="/activities-to-approve">Activities to approve</Link>
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
            {activity.status === "APPROVED" && (
              <div className="mt-3">
                <SdgChips sdgs={activity.sdgs} />
              </div>
            )}
            {activity.review?.comment && <p className="mt-2 text-[12px] text-ink">“{activity.review.comment}”</p>}
          </section>
        ) : (
          <section className="mt-4 rounded-card border border-line bg-surface">
            <NoAccessState
              action={<Link className={secondaryButtonClass} href="/activities-to-approve">Back to activities</Link>}
              description="Only the society’s SPC approves its activities."
              title="You can’t approve this activity"
            />
          </section>
        )}
        <ActivityDetails activity={activity} />
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
