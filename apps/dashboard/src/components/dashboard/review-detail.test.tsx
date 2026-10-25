import type { SubmissionAction, SubmissionDetail } from "@sarvodaya-connect/api-contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewDetail } from "./review-detail";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function submission(allowedActions: SubmissionAction[], overrides: Partial<SubmissionDetail> = {}): SubmissionDetail {
  return {
    id: "f7cdf50d-2f7d-4e06-ac47-72319175e078",
    reference: "SUB-00004",
    societyId: "29000000-0000-4000-8000-000000000101",
    societyName: "Example Sunrise Society",
    submittedBy: "demo-officer-sunrise",
    submittedByName: "Demo Officer",
    type: "PROFILE_UPDATE",
    title: "Village change",
    status: "UNDER_REVIEW",
    version: 3,
    correctionStatus: "NONE",
    changes: [
      { field: "profile.village", label: "Village", previousValue: "Old Village", proposedValue: "New Village", correctionStatus: "NONE" },
      { field: "profile.addressLine", label: "Address", previousValue: "1 Test Road", proposedValue: "2 Test Road", correctionStatus: "NONE" },
    ],
    documents: [],
    reviews: [],
    events: [
      {
        id: "e1",
        action: "START_REVIEW",
        fromStatus: "SUBMITTED",
        toStatus: "UNDER_REVIEW",
        actorId: "demo-dm-north",
        actorDisplayName: "Demo District Manager",
        createdAt: "2026-10-26T11:30:00.000Z",
      },
    ],
    allowedActions,
    updatedAt: "2026-10-26T11:30:00.000Z",
    ...overrides,
  };
}

describe("ReviewDetail", () => {
  const performAction = vi.fn();

  beforeEach(() => {
    performAction.mockReset();
    performAction.mockResolvedValue({ ok: true });
    refresh.mockReset();
  });

  it("shows current and proposed values with the decision history", () => {
    render(<ReviewDetail performAction={performAction} submission={submission(["APPROVE"])} />);

    expect(screen.getByText("Old Village")).toBeInTheDocument();
    expect(screen.getByText("New Village")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Decision history" })).toHaveTextContent("Demo District Manager");
  });

  it("offers only the actions the API allows", () => {
    render(<ReviewDetail performAction={performAction} submission={submission(["START_REVIEW"], { status: "SUBMITTED" })} />);

    expect(screen.getByRole("button", { name: "Start review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("shows no decision buttons when nothing is allowed", () => {
    render(<ReviewDetail performAction={performAction} submission={submission([], { status: "APPROVED" })} />);

    expect(screen.queryByRole("region", { name: "Review decision" })).not.toBeInTheDocument();
  });

  it("approves with the version it last saw and refreshes", async () => {
    const user = userEvent.setup();
    render(<ReviewDetail performAction={performAction} submission={submission(["APPROVE", "REJECT", "REQUEST_CHANGES"])} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(performAction).toHaveBeenCalledWith({ id: "f7cdf50d-2f7d-4e06-ac47-72319175e078", version: 3, action: "APPROVE" });
    expect(refresh).toHaveBeenCalled();
  });

  it("does not reject without a reason", async () => {
    const user = userEvent.setup();
    render(<ReviewDetail performAction={performAction} submission={submission(["APPROVE", "REJECT"])} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Confirm rejection" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/reason/i);
    expect(performAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Reason for rejecting"), "Not a registered member");
    await user.click(screen.getByRole("button", { name: "Confirm rejection" }));

    expect(performAction).toHaveBeenCalledWith(expect.objectContaining({ action: "REJECT", comment: "Not a registered member" }));
  });

  it("requires a selected field and a comment before returning a submission", async () => {
    const user = userEvent.setup();
    render(<ReviewDetail performAction={performAction} submission={submission(["REQUEST_CHANGES"])} />);

    await user.click(screen.getByRole("button", { name: "Request changes" }));
    await user.click(screen.getByRole("button", { name: "Send changes request" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at least one field/i);

    await user.click(screen.getByRole("checkbox", { name: "Return Village" }));
    await user.click(screen.getByRole("button", { name: "Send changes request" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/comment for each/i);
    expect(performAction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Comment for Village"), "Check the spelling");
    await user.click(screen.getByRole("button", { name: "Send changes request" }));

    expect(performAction).toHaveBeenCalledWith({
      id: "f7cdf50d-2f7d-4e06-ac47-72319175e078",
      version: 3,
      action: "REQUEST_CHANGES",
      fields: [{ field: "profile.village", comment: "Check the spelling" }],
    });
  });

  it("explains a conflict and offers a reload, without refreshing on its own", async () => {
    performAction.mockResolvedValue({ ok: false, conflict: true, message: "This submission changed since you opened it" });
    const user = userEvent.setup();
    render(<ReviewDetail performAction={performAction} submission={submission(["APPROVE"])} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(screen.getByRole("alert")).toHaveTextContent("changed since you opened it");
    expect(refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Reload this submission" }));
    expect(refresh).toHaveBeenCalled();
  });
});
