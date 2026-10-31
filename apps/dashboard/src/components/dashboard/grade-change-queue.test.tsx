import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GradeChangeRequest } from "@sarvodaya-connect/api-contracts";
import { GradeChangeReview, GradeChangeQueue } from "./grade-change-queue";

const request: GradeChangeRequest = {
  id: "00000000-0000-4000-8000-000000000001", societyId: "00000000-0000-4000-8000-000000000101", societyName: "Example Sunrise Society", societyCode: "DEMO-SOC-001", district: { id: "district-1", code: "N", nameEn: "North" }, currentGrade: "B", proposedGrade: "A", rationale: "The society meets the published grade criteria.", status: "PENDING", requestedBy: { id: "officer", name: "Society Officer" }, requestedAt: "2026-10-20T08:00:00.000Z", societySummary: { memberCount: 20, memberYear: 2026, excoCount: 25 }, history: [],
};
const response = (body: unknown, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
afterEach(() => vi.unstubAllGlobals());

describe("grade change screens", () => {
  it("loads the persisted queue and filters by status", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: [request], meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 } }));
    vi.stubGlobal("fetch", fetch);
    render(<GradeChangeQueue />);
    expect(await screen.findByText("Example Sunrise Society")).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Filter request status" }), "APPROVED");
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("status=APPROVED"), expect.anything()));
  });

  it("requires a comment and persists an HQ decision", async () => {
    const approved = { ...request, status: "APPROVED", decidedBy: { id: "hq", name: "HQ" }, decisionComment: "Evidence reviewed and accepted.", proposedGrade: "A" };
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(request))
      .mockResolvedValueOnce(response(approved));
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<GradeChangeReview id={request.id} />);
    const approve = await screen.findByRole("button", { name: "Approve grade A" });
    expect(approve).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Comment to the requester" }), "Evidence reviewed and accepted.");
    await user.click(approve);
    expect(await screen.findByText(/This request has already been approved/)).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(`/api/grade-changes/${request.id}`, expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "APPROVED", comment: "Evidence reviewed and accepted." }) }));
  });

  it("shows a load error and allows retry", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(response(request));
    vi.stubGlobal("fetch", fetch);
    render(<GradeChangeReview id={request.id} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Example Sunrise Society")).toBeInTheDocument();
  });
});
