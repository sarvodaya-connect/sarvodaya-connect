import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FilterBar, SectionCard } from "./section-card";

/** Issue #179: the shared modern card keeps headings and landmarks accessible. */
describe("SectionCard", () => {
  it("shows the label above the title and names the section by its title", () => {
    render(
      <SectionCard eyebrow="Record" id="details" n={2} title="Society Details">
        <p>Body</p>
      </SectionCard>,
    );
    const section = screen.getByRole("region", { name: "Society Details" });
    expect(section).toHaveTextContent("Record");
    // The step number is read once with the label, not as a separate element.
    expect(screen.getByText("2 ·")).toHaveClass("sr-only");
    expect(screen.getByRole("heading", { level: 2, name: "Society Details" })).toBeInTheDocument();
  });

  it("keeps the heading level a page needs", () => {
    render(
      <SectionCard eyebrow="Plan" headingLevel={3} title="Annual Work Plan">
        <p>Body</p>
      </SectionCard>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Annual Work Plan" })).toBeInTheDocument();
  });

  it("renders the actions beside the title and the body without a title", () => {
    const { rerender } = render(
      <SectionCard action={<button type="button">Edit</button>} title="Staff">
        <p>Body</p>
      </SectionCard>,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    rerender(
      <SectionCard>
        <p>Only the body</p>
      </SectionCard>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Only the body")).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  it("is a labelled search landmark that keeps every control", () => {
    render(
      <FilterBar label="Filter societies">
        <input aria-label="Name" />
        <select aria-label="District" />
      </FilterBar>,
    );
    const bar = screen.getByRole("search", { name: "Filter societies" });
    expect(bar).toContainElement(screen.getByRole("textbox", { name: "Name" }));
    expect(bar).toContainElement(screen.getByRole("combobox", { name: "District" }));
  });
});
