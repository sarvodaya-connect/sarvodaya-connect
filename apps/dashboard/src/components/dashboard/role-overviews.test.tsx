import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DistrictOverview, NationalOverview, PlatformAdminOverview } from "./role-overviews";

describe("role overviews", () => {
  it("shows the catalogue national dashboard sections and indicators", () => {
    render(<NationalOverview />);

    expect(screen.getByRole("heading", { name: "Latest Shramadana Societies status" })).toBeInTheDocument();
    expect(screen.getByText("5,340")).toBeInTheDocument();
    expect(screen.getByText("98,640")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Dashboard sections" })).toHaveTextContent("3–4 · Audit & AGM");
    expect(screen.getByRole("heading", { name: "Total wealth of all SSSs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Society locations across Sri Lanka" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Emergency / disaster status" })).toBeInTheDocument();
    expect(screen.getByText(/Environment & Climate Change/)).toBeInTheDocument();
  });

  it("renders the catalogue district dashboard metrics and five analysis blocks", () => {
    render(<DistrictOverview />);

    expect(screen.getByRole("heading", { name: "Good morning, R. Fernando" })).toBeInTheDocument();
    expect(screen.getByText("Societies in district")).toBeInTheDocument();
    expect(screen.getByText("Waiting for my review")).toBeInTheDocument();
    expect(screen.getByText("Not updated (90+ days)")).toBeInTheDocument();
    expect(screen.getByText("88%", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "LKR 168.2M" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key stats · villages in district" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open review queue (14)" })).toHaveAttribute("href", "/reviews");
  });

  it("shows the prototype user table and switches to role and audit tabs", async () => {
    const user = userEvent.setup();
    render(<PlatformAdminOverview />);

    expect(screen.getByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Demonstration platform users, roles and access scopes" })).toBeInTheDocument();
    expect(screen.getByText("R. Fernando")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Roles & permissions" }));
    expect(screen.getByRole("table", { name: "Demonstration role permissions and scopes" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "System audit log" }));
    expect(screen.getByRole("table", { name: "Recent platform administration audit events" })).toBeInTheDocument();
  });
});
