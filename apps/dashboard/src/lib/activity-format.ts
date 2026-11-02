import type { ActivityDimension, ActivityQueueItem, WorkPlanActivity } from "@sarvodaya-connect/api-contracts";

import { formatDate, waitingLabel } from "./society-record-format";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DIMENSION_LABELS: Record<ActivityDimension, string> = {
  SOCIAL: "Social",
  ECONOMIC: "Economic",
  GOVERNANCE: "Governance",
};

/** "Sep 2027" */
export function monthYear(item: { month: number; year: number }) {
  return `${MONTH_NAMES[item.month - 1]!.slice(0, 3)} ${item.year}`;
}

/** "12–14 Sep · September 2027" */
export function whenLabel(activity: Pick<WorkPlanActivity, "datesLabel" | "month" | "year">) {
  const month = `${MONTH_NAMES[activity.month - 1]} ${activity.year}`;
  return activity.datesLabel ? `${activity.datesLabel} · ${month}` : month;
}

/** "38 · 146 households" */
export function participantsLabel(item: Pick<ActivityQueueItem, "totalParticipants" | "householdsBenefited">) {
  return item.householdsBenefited != null
    ? `${item.totalParticipants} · ${item.householdsBenefited} households`
    : String(item.totalParticipants);
}

/** "Waiting · today", "Waiting · 2 days" */
export function waitingStatus(submittedAt?: string, now = new Date()) {
  return submittedAt ? `Waiting · ${waitingLabel(submittedAt, now)}` : "Waiting";
}

/** "Today" or "25 Oct" */
export function approvedLabel(value: string | undefined, now = new Date()) {
  if (!value) return "—";
  const date = formatDate(value);
  if (date === formatDate(now.toISOString())) return "Today";
  return date.replace(/ \d{4}$/, "");
}

/** "SDG 4 and 16", "SDG 3, 6 and 15" */
export function sdgList(sdgs: number[]) {
  if (sdgs.length <= 1) return `SDG ${sdgs.join("")}`;
  return `SDG ${sdgs.slice(0, -1).join(", ")} and ${sdgs.at(-1)}`;
}

/** The most recent financial year (1 Apr – 31 Mar) that has ended, in Sri Lanka time; the API uses the same rule. */
export function latestCompletedFinancialYear(now = new Date()) {
  const local = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return local.getUTCMonth() >= 3 ? local.getUTCFullYear() - 1 : local.getUTCFullYear() - 2;
}

/** The five financial years that can be viewed, newest first. */
export function selectableStartYears(now = new Date()) {
  const latest = latestCompletedFinancialYear(now);
  return Array.from({ length: 5 }, (_, index) => latest - index);
}
