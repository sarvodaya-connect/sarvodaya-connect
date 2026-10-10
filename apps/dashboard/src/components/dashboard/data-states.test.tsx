import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState, NoResultsState, TableSkeleton } from "./data-states";

describe("TableSkeleton", () => {
  it("announces a single busy loading status", () => {
    render(<TableSkeleton label="Loading societies" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading societies…");
  });
});

describe("EmptyState", () => {
  it("renders the title, description and optional action", () => {
    render(
      <EmptyState
        action={<button type="button">Add society</button>}
        description="Nothing has been added yet."
        title="No societies"
      />,
    );

    expect(screen.getByRole("heading", { name: "No societies" })).toBeInTheDocument();
    expect(screen.getByText("Nothing has been added yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add society" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("is announced as an alert and retries when the action is used", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} reference="digest-123" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText("digest-123")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("can be retried from the keyboard", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("NoResultsState", () => {
  it("lists each active filter with its own remove action", async () => {
    const user = userEvent.setup();
    const onRemoveFilter = vi.fn();
    const onClearAll = vi.fn();
    render(
      <NoResultsState
        filters={[
          { id: "query", label: "Search", value: "“Kandy”" },
          { id: "status", label: "Status", value: "Inactive" },
        ]}
        itemLabel="societies"
        onClearAll={onClearAll}
        onRemoveFilter={onRemoveFilter}
      />,
    );

    expect(screen.getByRole("heading", { name: "No societies match your filters" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Remove Status filter" }));
    expect(onRemoveFilter).toHaveBeenCalledWith("status");

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
