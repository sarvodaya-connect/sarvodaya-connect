import { render, screen } from "@testing-library/react";
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
  });

  it("shows district-scoped society and review information", () => {
    render(<DistrictOverview />);

    expect(screen.getByRole("heading", { name: "Kurunegala District" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Societies requiring follow-up in Kurunegala District" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open review queue" })).toHaveAttribute("href", "/reviews");
  });

  it("shows fictional account scopes on the platform access screen", () => {
    render(<PlatformAdminOverview />);

    expect(screen.getByRole("heading", { name: "Platform administration" })).toBeInTheDocument();
    expect(screen.getByText("k.fernando@example.invalid")).toBeInTheDocument();
    expect(screen.getByText(/does not grant or enforce real permissions/)).toBeInTheDocument();
  });
});
