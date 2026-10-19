import { describe, expect, it } from "vitest";

import { societyDetails } from "./demo-registry";
import { societiesVisibleTo } from "./society-access";

describe("societiesVisibleTo", () => {
  it("limits district managers to assigned districts", () => {
    const visible = societiesVisibleTo(societyDetails, {
      role: "DISTRICT_MANAGER",
      districtIds: ["district-kandy"],
      societyIds: [],
    });

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((society) => society.district.id === "district-kandy")).toBe(true);
  });

  it("limits society officers to assigned society records", () => {
    const visible = societiesVisibleTo(societyDetails, {
      role: "SOCIETY_OFFICER",
      districtIds: [],
      societyIds: ["society-galewela"],
    });

    expect(visible.map((society) => society.id)).toEqual(["society-galewela"]);
  });

  it("allows headquarters administrators to see the full registry", () => {
    expect(societiesVisibleTo(societyDetails, {
      role: "HQ_ADMIN",
      districtIds: [],
      societyIds: [],
    })).toEqual(societyDetails);
  });
});
