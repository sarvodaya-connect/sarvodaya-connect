import { describe, expect, it } from "vitest";

import { getMissingProfileInformation, getProfileCompleteness, societyDetails } from "./demo-registry";

describe("society profile completeness", () => {
  it("marks a complete profile as complete with no missing fields", () => {
    const society = societyDetails.find((item) => item.id === "society-pahala-kosgama")!;

    expect(getProfileCompleteness(society)).toBe(100);
    expect(getMissingProfileInformation(society)).toEqual([]);
  });

  it("reports missing GPS and keeps the calculated percentage in sync", () => {
    const society = societyDetails.find((item) => item.id === "society-galewela")!;

    expect(getMissingProfileInformation(society)).toContain("GPS location");
    expect(society.profileCompleteness).toBe(getProfileCompleteness(society));
  });
});
