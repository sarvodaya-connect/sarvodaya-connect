import { describe, expect, it } from "vitest";

import { societyDetails } from "./demo-registry";
import { searchRegistry } from "./registry-search";

describe("searchRegistry", () => {
  it("finds societies by name, code and division", () => {
    expect(searchRegistry(societyDetails, "SSS-KG-001").some((result) => result.kind === "Society")).toBe(true);
    expect(searchRegistry(societyDetails, "Polgahawela").some((result) => result.kind === "Society")).toBe(true);
  });

  it("finds related contacts, committee members, documents and history", () => {
    expect(searchRegistry(societyDetails, "Nimal Perera").some((result) => result.kind === "Contact")).toBe(true);
    expect(searchRegistry(societyDetails, "Treasurer").some((result) => result.kind === "Committee")).toBe(true);
    expect(searchRegistry(societyDetails, "registration-certificate.pdf").some((result) => result.kind === "Document")).toBe(true);
    expect(searchRegistry(societyDetails, "committee update recorded").some((result) => result.kind === "History")).toBe(true);
  });

  it("returns no records for an empty or unmatched query", () => {
    expect(searchRegistry(societyDetails, " ")).toEqual([]);
    expect(searchRegistry(societyDetails, "no-such-record")).toEqual([]);
  });
});
