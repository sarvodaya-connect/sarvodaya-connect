import { describe, expect, it } from "vitest";

import * as contracts from "@sarvodaya-connect/api-contracts";

import { ACTIVITY_CATEGORIES, ACTIVITY_DIMENSIONS } from "./activity-format";

describe("the approval catalogue copied for the browser", () => {
  it("matches the server-defined dimensions and categories, in order", () => {
    expect(ACTIVITY_DIMENSIONS).toEqual(contracts.ACTIVITY_DIMENSIONS);
    expect(ACTIVITY_CATEGORIES).toEqual(contracts.ACTIVITY_CATEGORIES);
  });
});
