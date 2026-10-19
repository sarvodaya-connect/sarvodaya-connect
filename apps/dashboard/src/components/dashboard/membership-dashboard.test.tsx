import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  calculateMembershipTotals,
  demoMembershipSocieties,
} from "@/lib/demo-membership";
import { MembershipDashboard } from "./membership-dashboard";

describe("MembershipDashboard", () => {
  it("shows total members and female/male category breakdowns", () => {
    render(
      <MembershipDashboard
        summary={calculateMembershipTotals(demoMembershipSocieties.slice(0, 1))}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Membership" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("4,293")).toHaveLength(3);
    expect(
      screen.getByRole("row", { name: /Children 178 164 342/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("row", { name: /Mothers 526 0 526/ }),
    ).toBeInTheDocument();
  });

  it("shows an empty-scope message when there are no permitted societies", () => {
    render(<MembershipDashboard summary={calculateMembershipTotals([])} />);
    expect(
      screen.getByText("No membership records in your scope"),
    ).toBeInTheDocument();
  });
});
