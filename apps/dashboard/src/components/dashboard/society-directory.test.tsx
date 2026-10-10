import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { districts, societies } from "@/lib/demo-registry";

import { SocietyDirectory } from "./society-directory";

function renderDirectory(items = societies) {
  const user = userEvent.setup();
  render(<SocietyDirectory districts={districts} societies={items} />);
  return { user };
}

describe("SocietyDirectory", () => {
  it("lists every society with a labelled open action when no filters are applied", () => {
    renderDirectory();

    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(societies.length);
    expect(screen.getByRole("link", { name: "Open Galewela Sarvodaya Shramadana Society" })).toHaveAttribute(
      "href",
      "/societies/society-galewela",
    );
    expect(screen.getByText(`Showing ${societies.length} of ${societies.length} demonstration records`)).toBeInTheDocument();
  });

  it("gives the search and filter controls readable labels", () => {
    renderDirectory();

    expect(screen.getByRole("searchbox", { name: "Search societies" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by district" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by status" })).toBeInTheDocument();
  });

  it("filters societies by search term", async () => {
    const { user } = renderDirectory();

    await user.type(screen.getByRole("searchbox", { name: "Search societies" }), "galewela");

    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(1);
    expect(screen.getByText(`Showing 1 of ${societies.length} demonstration records`)).toBeInTheDocument();
  });

  it("shows a no-results state that lists the active filters", async () => {
    const { user } = renderDirectory();

    await user.type(screen.getByRole("searchbox", { name: "Search societies" }), "zzz");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by district" }), "district-kandy");

    expect(screen.getByRole("heading", { name: "No societies match your filters" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const filters = within(screen.getByRole("list", { name: "Active filters" }));
    expect(filters.getByText("“zzz”")).toBeInTheDocument();
    expect(filters.getByText("Kandy")).toBeInTheDocument();
    expect(filters.queryByText("Status:")).not.toBeInTheDocument();
  });

  it("removes a single filter from the no-results state", async () => {
    const { user } = renderDirectory();

    await user.type(screen.getByRole("searchbox", { name: "Search societies" }), "Galewela");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by district" }), "district-kandy");
    await user.click(screen.getByRole("button", { name: "Remove District filter" }));

    expect(screen.getByRole("link", { name: "Open Galewela Sarvodaya Shramadana Society" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by district" })).toHaveValue("all");
    expect(screen.getByRole("searchbox", { name: "Search societies" })).toHaveValue("Galewela");
  });

  it("clears all filters from the keyboard and returns focus to the search field", async () => {
    const { user } = renderDirectory();

    await user.type(screen.getByRole("searchbox", { name: "Search societies" }), "zzz");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "INACTIVE");

    screen.getByRole("button", { name: "Clear all filters" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(societies.length);
    expect(screen.getByRole("searchbox", { name: "Search societies" })).toHaveFocus();
    expect(screen.getByRole("searchbox", { name: "Search societies" })).toHaveValue("");
  });

  it("shows an empty state when the registry has no societies", () => {
    renderDirectory([]);

    expect(screen.getByRole("heading", { name: "No societies in the registry yet" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
