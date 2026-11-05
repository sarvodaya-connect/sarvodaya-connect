import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConflictState, EmptyState, ErrorState, NoAccessState, NoResultsState, SuccessState, TableSkeleton } from "./data-states";

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

    expect(screen.getByRole("alert")).toHaveTextContent("We Couldn’t Load This Page");
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

    expect(screen.getByRole("heading", { name: "No Societies Match" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Remove Status filter" }));
    expect(onRemoveFilter).toHaveBeenCalledWith("status");

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});

describe("NoAccessState", () => {
  it("uses the V5 wording and never needs the restricted record", () => {
    render(<NoAccessState />);

    expect(screen.getByRole("heading", { name: "You Don’t Have Access to This Page" })).toBeInTheDocument();
    expect(screen.getByText("Your role cannot open it. Ask HQ if you think you need it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to overview" })).toHaveAttribute("href", "/dashboard");
  });

  it("can be the page heading with a custom way back", () => {
    render(<NoAccessState action={<button type="button">Back to my societies</button>} heading="h1" />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to my societies" })).toBeInTheDocument();
  });
});

describe("SuccessState", () => {
  it("announces the result with its follow-up action", () => {
    render(<SuccessState action={<button type="button">Back to queue</button>} description="Everyone has been told." title="Grade Decision Saved" />);

    expect(screen.getByRole("status")).toHaveTextContent("Grade Decision Saved");
    expect(screen.getByRole("button", { name: "Back to queue" })).toBeInTheDocument();
  });
});

describe("ConflictState", () => {
  it("asks staff to reload a conflicting record without submitting stale changes", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(<ConflictState onReload={onReload} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Your changes have not been saved");
    await user.click(screen.getByRole("button", { name: "Reload record" }));
    expect(onReload).toHaveBeenCalledOnce();
  });
});
