import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ENGLISH } from "@/i18n/english";
import { DevelopmentGoals } from "./development-goals";

describe("read-only Development Goals", () => {
  it("shows only saved selections in catalogue order", () => {
    render(<DevelopmentGoals activity={{
      status: "APPROVED",
      classification: { dimensions: ["GOVERNANCE", "SOCIAL"], categories: ["ENVIRONMENT", "COMMUNITY_EDUCATION"] },
      sdgs: [16, 4],
    }} t={ENGLISH} />);

    const goals = within(screen.getByRole("region", { name: "Development Goals" }));
    expect(goals.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Social", "Governance", "Community education", "Environment",
    ]);
    expect(goals.getByText("Quality Education")).toBeInTheDocument();
    expect(goals.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([null, undefined])("retains known SDGs for a legacy classification (%s)", (classification) => {
    render(<DevelopmentGoals activity={{ status: "APPROVED", classification, sdgs: [4] }} t={ENGLISH} />);
    expect(screen.getByText("Sarvodaya classification not yet recorded.")).toBeInTheDocument();
    expect(screen.getByText("Quality Education")).toBeInTheDocument();
    expect(screen.queryByText("Sarvodaya dimensions")).not.toBeInTheDocument();
  });

  it("explains pending approval without showing unpublished goals", () => {
    render(<DevelopmentGoals activity={{ status: "WAITING_FOR_SPC", sdgs: [4] }} t={ENGLISH} />);
    expect(screen.getByText("The SPC selects the Development Goals during approval.")).toBeInTheDocument();
    expect(screen.queryByText("Quality Education")).not.toBeInTheDocument();
  });

  it("distinguishes an approved activity without SDGs", () => {
    render(<DevelopmentGoals activity={{ status: "APPROVED", sdgs: [] }} t={ENGLISH} />);
    expect(screen.getByText("No UN SDGs recorded.")).toBeInTheDocument();
  });
});
