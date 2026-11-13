import { describe, expect, it } from "vitest";

import * as contracts from "../../../../packages/api-contracts/src/economy";
import * as local from "./economy-catalogue";

describe("Village Economic Profile catalogue (issue #147)", () => {
  it("is the same list as the shared API contract", () => {
    for (const name of ["ECONOMY_INDUSTRIES", "BUSINESS_STATUSES", "PRODUCTION_UNITS", "ECONOMY_PRODUCTS", "PRODUCTION_BASES", "PRODUCTION_MEASUREMENTS"] as const)
      expect(local[name], name).toEqual(contracts[name]);
  });
});
