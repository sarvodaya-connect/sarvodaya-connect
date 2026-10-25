import "server-only";

import type { SubmissionDetail } from "@sarvodaya-connect/api-contracts";

import type { ReviewQueueItem } from "./demo-registry";
import type { DemoViewer } from "./access";
import { toReviewQueueItems } from "./submission-view";

/** Demo identities until Amazon Cognito replaces them. Only reviewers may use the review screens. */
const REVIEWER_API_USERS = {
  HQ_ADMIN: "demo-hq-admin",
  DISTRICT_MANAGER: "demo-dm-north",
} as const;

export function reviewerApiUser(viewer: DemoViewer): string | undefined {
  return REVIEWER_API_USERS[viewer.role as keyof typeof REVIEWER_API_USERS];
}

export function submissionApiUrl(path: string) {
  const base = process.env.API_BASE_URL?.trim() || "http://localhost:3001/api/v1";
  return `${base.replace(/\/$/, "")}${path}`;
}

export type ReviewQueueData =
  | { available: true; items: ReviewQueueItem[] }
  | { available: false; message: string };

export async function getReviewQueue(viewer: DemoViewer): Promise<ReviewQueueData> {
  const user = reviewerApiUser(viewer);
  if (!user) return { available: false, message: "Your role does not review submissions." };
  try {
    const response = await fetch(submissionApiUrl("/submissions?pageSize=100"), {
      headers: { "X-Demo-User": user },
      cache: "no-store",
    });
    if (!response.ok) {
      return { available: false, message: `The local API returned ${response.status}. Check its logs and the signed-in role.` };
    }
    const body = (await response.json()) as { data: SubmissionDetail[] };
    return { available: true, items: toReviewQueueItems(body.data) };
  } catch {
    return { available: false, message: "The local API is unavailable. Start the NestJS API and PostgreSQL, then refresh this page." };
  }
}

export type SubmissionResult =
  | { status: "ok"; submission: SubmissionDetail }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "unavailable"; message: string };

export async function getSubmission(viewer: DemoViewer, id: string): Promise<SubmissionResult> {
  const user = reviewerApiUser(viewer);
  if (!user) return { status: "forbidden" };
  try {
    const response = await fetch(submissionApiUrl(`/submissions/${encodeURIComponent(id)}`), {
      headers: { "X-Demo-User": user },
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 400) return { status: "not-found" };
    if (response.status === 403) return { status: "forbidden" };
    if (!response.ok) {
      return { status: "unavailable", message: `The local API returned ${response.status}.` };
    }
    return { status: "ok", submission: (await response.json()) as SubmissionDetail };
  } catch {
    return { status: "unavailable", message: "The local API is unavailable. Start the NestJS API and PostgreSQL, then refresh this page." };
  }
}
