import { expect, it } from "vitest";

import * as contracts from "../../../../packages/api-contracts/src/activities";
import { ACTIVITY_CATEGORIES, ACTIVITY_DIMENSIONS } from "./v5-constants";

it("keeps the dashboard classification catalogue in API order", () => {
  expect(ACTIVITY_CATEGORIES).toEqual(contracts.ACTIVITY_CATEGORIES);
  expect(ACTIVITY_DIMENSIONS).toEqual(contracts.ACTIVITY_DIMENSIONS);
});
