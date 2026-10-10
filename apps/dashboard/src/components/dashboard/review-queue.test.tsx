import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { reviewQueue } from "@/lib/demo-registry";

import { ReviewQueue } from "./review-queue";

describe("ReviewQueue", () => {
  it("lists submissions with labelled review actions", () => {
    render(<ReviewQueue items={reviewQueue} />);

    expect(screen.getAllByRole("link", { name: /^Review SUB-/ })).toHaveLength(reviewQueue.length);
  });

  it("shows the active filters when no submissions match", async () => {
    const user = userEvent.setup();
    render(<ReviewQueue items={reviewQueue} />);

    await user.type(screen.getByRole("searchbox", { name: "Search submissions" }), "SUB-9999");

    expect(screen.getByRole("heading", { name: "No submissions match your filters" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Active filters" })).getByText("“SUB-9999”")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(screen.getAllByRole("link", { name: /^Review SUB-/ })).toHaveLength(reviewQueue.length);
  });

  it("shows an empty state when nothing is waiting for review", () => {
    render(<ReviewQueue items={[]} />);

    expect(screen.getByRole("heading", { name: "No submissions waiting for review" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
