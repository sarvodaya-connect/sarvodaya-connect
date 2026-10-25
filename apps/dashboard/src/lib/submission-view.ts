import type { SubmissionDetail, SubmissionType } from "@sarvodaya-connect/api-contracts";

import type { ReviewQueueItem } from "./demo-registry";

/** Statuses that need a reviewer's attention. */
export const REVIEWABLE_STATUSES = ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"] as const;

const TYPE_LABEL: Record<SubmissionType, ReviewQueueItem["type"]> = {
  COUNCIL_UPDATE: "Committee update",
  PROFILE_UPDATE: "Profile update",
  MEMBERSHIP_COUNTS: "Membership counts",
  ACTIVITY_REPORT: "Activity report",
  PAYMENT: "Payment",
};

export function submissionTypeLabel(type: SubmissionType): string {
  return TYPE_LABEL[type];
}

export function waitingLabel(since: string, now = Date.now()): string {
  const started = new Date(since).getTime();
  if (!Number.isFinite(started)) return "—";
  const minutes = Math.max(0, Math.floor((now - started) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Oldest first, only submissions that wait for or are in review. */
export function toReviewQueueItems(rows: SubmissionDetail[], now = Date.now()): ReviewQueueItem[] {
  return rows
    .filter((row) => (REVIEWABLE_STATUSES as readonly string[]).includes(row.status))
    .map((row) => {
      const since = row.submittedAt ?? row.updatedAt;
      return {
        id: row.id,
        reference: row.reference,
        societyId: row.societyId,
        societyName: row.societyName ?? "Unnamed society",
        societyCode: row.societyCode ?? "",
        type: TYPE_LABEL[row.type],
        submittedAt: since,
        status: row.status,
        waitingLabel: waitingLabel(since, now),
        submittedBy: row.submittedByName ?? row.submittedBy,
      };
    })
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
}
