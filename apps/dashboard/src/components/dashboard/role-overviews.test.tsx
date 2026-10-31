import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DistrictOverview, NationalOverview, PlatformAdminOverview } from "./role-overviews";

afterEach(() => vi.unstubAllGlobals());

describe("role overviews", () => {
  it("loads national totals and grade queue from the API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ asOf: "2026-10-31T08:00:00.000Z", registeredSocieties: 6, activeSocieties: 3, gradeCounts: { A: 1, B: 1, C: 1 }, pendingGradeRequests: [], pendingGradeRequestCount: 0, activeDdmDelegations: 1, districts: [], latestChanges: [], locations: [], staleSocieties: 0, annualPlanCoverage: null, accountActivation: null, activeIncident: null }) }));
    render(<NationalOverview />);
    expect(await screen.findByText("Temporary DDM access")).toBeInTheDocument();
    expect(screen.getByText("Accounts not activated")).toBeInTheDocument();
    expect(screen.getByText("Temporary DDM access")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Waiting for HQ/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open queue/ })).toHaveAttribute("href", "/grade-changes");
  });

  it("renders the district dashboard metrics", () => {
    render(<DistrictOverview />);
    expect(screen.getByRole("heading", { name: "Good morning, R. Fernando" })).toBeInTheDocument();
    expect(screen.getByText("Societies in district")).toBeInTheDocument();
    expect(screen.getByText("Waiting for my review")).toBeInTheDocument();
  });

  it("shows platform user table and role and audit tabs", async () => {
    const user = userEvent.setup(); render(<PlatformAdminOverview />);
    expect(screen.getByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Demonstration platform users, roles and access scopes" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Roles & permissions" }));
    expect(screen.getByRole("table", { name: "Demonstration role permissions and scopes" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "System audit log" }));
    expect(screen.getByRole("table", { name: "Recent platform administration audit events" })).toBeInTheDocument();
  });
});
