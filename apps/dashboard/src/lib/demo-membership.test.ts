import { describe, expect, it } from "vitest";
import { getViewer } from "./access";
import {
  calculateMembershipTotals,
  demoMembershipSocieties,
  membershipVisibleTo,
} from "./demo-membership";

describe("membership dashboard calculations", () => {
  it("calculates category and gender totals consistently", () => {
    const summary = calculateMembershipTotals(
      demoMembershipSocieties.slice(0, 1),
    );
    expect(summary.femaleTotal).toBe(2517);
    expect(summary.maleTotal).toBe(1776);
    expect(summary.overallTotal).toBe(4293);
    expect(summary.categories.map(({ total }) => total)).toEqual([
      342, 465, 526, 2813, 147,
    ]);
    expect(summary.categories.reduce((sum, row) => sum + row.total, 0)).toBe(
      summary.overallTotal,
    );
  });

  it("limits membership records to each viewer's society scope", () => {
    expect(
      membershipVisibleTo(demoMembershipSocieties, getViewer("hq-admin")),
    ).toHaveLength(7);
    expect(
      membershipVisibleTo(
        demoMembershipSocieties,
        getViewer("district-manager"),
      ).map((row) => row.districtName),
    ).toEqual(["Kurunegala", "Kurunegala", "Kurunegala", "Kurunegala"]);
    expect(
      membershipVisibleTo(
        demoMembershipSocieties,
        getViewer("programme-coordinator"),
      ),
    ).toHaveLength(3);
    expect(
      membershipVisibleTo(demoMembershipSocieties, getViewer("system-admin")),
    ).toEqual([]);
  });

  it("returns zero totals for an empty scope", () => {
    const summary = calculateMembershipTotals([]);
    expect(summary.overallTotal).toBe(0);
    expect(summary.categories).toHaveLength(5);
  });
});
