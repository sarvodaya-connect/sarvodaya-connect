import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DistrictOverview, NationalOverview, PlatformAdminOverview } from "./role-overviews";

describe("role overviews", () => {
  it("shows national registry indicators and district drill-down", () => {
    render(<NationalOverview />);

    expect(screen.getByRole("heading", { name: "National overview" })).toBeInTheDocument();
    expect(screen.getByText("1,214")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open district view/ })).toHaveAttribute("href", "/districts/kurunegala");
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
    expect(screen.getByText(/URL-selected roles do not grant or enforce real permissions/)).toBeInTheDocument();
  });
});
