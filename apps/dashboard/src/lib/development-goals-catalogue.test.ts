import { describe, expect, it } from "vitest";

import * as contracts from "../../../../packages/api-contracts/src/activities";
import { en } from "@/i18n/messages/en";

import { CATEGORIES, categoryKey, DIMENSIONS, dimensionKey } from "./development-goals";

describe("Development Goals catalogue (issue #170)", () => {
  it("is the same list, in the same order, as the shared API contract", () => {
    expect(DIMENSIONS).toEqual(contracts.ACTIVITY_DIMENSIONS);
    expect(CATEGORIES).toEqual(contracts.ACTIVITY_CATEGORY_CODES);
  });

  it("shows each code with the contract's title (English Title Case)", () => {
    for (const code of DIMENSIONS) expect(en[dimensionKey(code)]).toBe(contracts.ACTIVITY_DIMENSION_TITLES[code]);
    for (const code of CATEGORIES)
      expect(en[categoryKey(code)].toLowerCase()).toBe(contracts.activityCategoryTitle(code).toLowerCase());
  });
});
