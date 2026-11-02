import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccessBanner } from "./access-banner";

describe("AccessBanner", () => {
  it("describes the viewer's access as a note", () => {
    render(
      <AccessBanner action="Ends Fri 31 Oct · 4 days left" tone="temporary">
        Temporary district-wide view · view only
      </AccessBanner>,
    );

    expect(screen.getByRole("note")).toHaveTextContent("Temporary district-wide view · view only");
    expect(screen.getByText("Ends Fri 31 Oct · 4 days left")).toBeInTheDocument();
  });

  it("raises an active incident as an alert", () => {
    render(<AccessBanner tone="incident">Active incident · Floods</AccessBanner>);

    expect(screen.getByRole("alert")).toHaveTextContent("Active incident · Floods");
  });
});
