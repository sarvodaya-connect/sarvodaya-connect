import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { searchRegistry } from "@/lib/registry-search";
import { societyDetails } from "@/lib/demo-registry";

import { GlobalSearchResults } from "./global-search";

describe("GlobalSearchResults", () => {
  it("links society and related-record matches to the owning profile", () => {
    render(<GlobalSearchResults query="registration-certificate.pdf" results={searchRegistry(societyDetails, "registration-certificate.pdf")} />);

    expect(screen.getByText("Document")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /registration-certificate\.pdf/ })).toHaveAttribute("href", "/societies/society-pahala-kosgama");
  });

  it("shows a useful no-result state for a query without matches", () => {
    render(<GlobalSearchResults query="missing" results={[]} />);

    expect(screen.getByRole("heading", { name: "No search results" })).toBeInTheDocument();
  });

  it("prompts users to search before a query is entered", () => {
    render(<GlobalSearchResults query="" results={[]} />);

    expect(screen.getByRole("heading", { name: "Search the society registry" })).toBeInTheDocument();
  });
});
