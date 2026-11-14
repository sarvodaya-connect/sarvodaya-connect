import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EmergencyIncidentSummary } from "@sarvodaya-connect/api-contracts";

import { parseCount } from "@/lib/count";

import { AssessmentWizard } from "./incident-forms";

/** Issue #132: counts in the dashboard rapid assessment can be typed. Everything is fictional. */

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const incident = { id: "incident-1", reference: "INC-2026-09", type: "FLOOD", title: "Fictional flood" } as EmergencyIncidentSummary;
const society = { id: "society-1", name: "Fictional Test Society A01", code: "S-90101", districtName: "Fictional North" };

function wizard() {
  const send = vi.fn(async () => ({ id: "assessment-1" }));
  render(
    <AssessmentWizard
      closeHref="/emergencies/incident-1"
      completeUpload={vi.fn()}
      incident={incident}
      send={send}
      societies={[society]}
      startUpload={vi.fn()}
    />,
  );
  return { send, user: userEvent.setup() };
}

describe("typed counts (issue #132)", () => {
  it("reads only whole numbers in range", () => {
    expect(parseCount("1,000", 1_000_000)).toBe(1000);
    expect(parseCount(" 42 ", 1_000_000)).toBe(42);
    for (const bad of ["", "-1", "2.5", "12a", "1000001", "1e3"]) expect(parseCount(bad, 1_000_000)).toBeNull();
  });

  it("types, steps, refuses invalid input, keeps the value across Back/Next and sends it", async () => {
    const { send, user } = wizard();
    await user.click(screen.getByRole("button", { name: "Next question" }));
    const families = () => screen.getByRole("textbox", { name: "Families affected" }) as HTMLInputElement;

    await user.clear(families());
    await user.type(families(), "250");
    await user.click(screen.getByRole("button", { name: "More: Families affected" }));
    expect(families().value).toBe("251");

    // Not silently fixed: the text stays and the box explains.
    await user.clear(families());
    await user.type(families(), "25o");
    expect(families().value).toBe("25o");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number from 0 to 1,000,000.");
    expect(families()).toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("One of the numbers is not a whole number in range. Fix it before going on.")).toBeInTheDocument();
    expect(families()).toBeInTheDocument();

    // Back keeps the last valid number: "25", typed just before the "o".
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(families().value).toBe("25");

    // Empty is not reset to zero while editing.
    await user.clear(families());
    expect(families().value).toBe("");
    await user.type(families(), "1,200");
    while (!screen.queryByRole("button", { name: "Check answers" })) await user.click(screen.getByRole("button", { name: "Next question" }));
    await user.click(screen.getByRole("button", { name: "Check answers" }));
    await user.click(screen.getByRole("button", { name: "Send assessment" }));
    expect(send).toHaveBeenCalledWith("incident-1", expect.objectContaining({ families: 1200, people: 0 }));
  });
});
