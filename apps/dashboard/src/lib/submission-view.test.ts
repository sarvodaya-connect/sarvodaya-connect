import type { SubmissionDetail } from "@sarvodaya-connect/api-contracts";
import { describe, expect, it } from "vitest";

import { toReviewQueueItems, waitingLabel } from "./submission-view";

const now = new Date("2026-10-26T12:00:00.000Z").getTime();

function row(overrides: Partial<SubmissionDetail>): SubmissionDetail {
  return {
    id: "f7cdf50d-2f7d-4e06-ac47-72319175e078",
    reference: "SUB-00004",
    societyId: "29000000-0000-4000-8000-000000000101",
    societyName: "Example Sunrise Society",
    societyCode: "DEMO-SOC-001",
    submittedBy: "demo-officer-sunrise",
    submittedByName: "Demo Officer",
    type: "COUNCIL_UPDATE",
    title: "Treasurer change",
    status: "SUBMITTED",
    version: 2,
    correctionStatus: "NONE",
    changes: [],
    documents: [],
    reviews: [],
    events: [],
    allowedActions: [],
    submittedAt: "2026-10-26T11:18:00.000Z",
    updatedAt: "2026-10-26T11:18:00.000Z",
    ...overrides,
  };
}

describe("review queue mapping", () => {
  it("formats waiting times", () => {
    expect(waitingLabel("2026-10-26T11:18:00.000Z", now)).toBe("42 min");
    expect(waitingLabel("2026-10-26T10:51:00.000Z", now)).toBe("1 hr 9 min");
    expect(waitingLabel("2026-10-24T12:00:00.000Z", now)).toBe("2 days");
    expect(waitingLabel("not a date", now)).toBe("—");
  });

  it("keeps only submissions that need review, oldest first", () => {
    const items = toReviewQueueItems(
      [
        row({ id: "newer", status: "UNDER_REVIEW", submittedAt: "2026-10-26T11:00:00.000Z" }),
        row({ id: "draft", status: "DRAFT" }),
        row({ id: "approved", status: "APPROVED" }),
        row({ id: "changes", status: "CHANGES_REQUESTED" }),
        row({ id: "older", status: "RESUBMITTED", submittedAt: "2026-10-25T09:00:00.000Z" }),
      ],
      now,
    );
    expect(items.map((item) => item.id)).toEqual(["older", "newer"]);
  });

  it("maps names and types for the queue", () => {
    const [item] = toReviewQueueItems([row({ type: "PAYMENT" })], now);
    expect(item).toMatchObject({
      societyName: "Example Sunrise Society",
      societyCode: "DEMO-SOC-001",
      type: "Payment",
      submittedBy: "Demo Officer",
      waitingLabel: "42 min",
    });
  });
});
