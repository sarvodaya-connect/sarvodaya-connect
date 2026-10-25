import { describe, expect, it } from "vitest";

import { validateReviewAction } from "./review-actions";

const id = "f7cdf50d-2f7d-4e06-ac47-72319175e078";

describe("validateReviewAction", () => {
  it("accepts approve and start review without a comment", () => {
    expect(validateReviewAction({ id, action: "APPROVE", version: 3 })).toEqual({ id, action: "APPROVE", version: 3 });
    expect(validateReviewAction({ id, action: "START_REVIEW", version: 2 })).toMatchObject({ action: "START_REVIEW" });
  });

  it("rejects a missing reason for rejection", () => {
    expect(validateReviewAction({ id, action: "REJECT", version: 3 })).toMatch(/reason/i);
    expect(validateReviewAction({ id, action: "REJECT", version: 3, comment: "   " })).toMatch(/reason/i);
    expect(validateReviewAction({ id, action: "REJECT", version: 3, comment: "Not registered" })).toMatchObject({ comment: "Not registered" });
  });

  it("requires a comment for every returned field, once each", () => {
    const base = { id, action: "REQUEST_CHANGES", version: 3 };
    expect(validateReviewAction(base)).toMatch(/at least one/i);
    expect(validateReviewAction({ ...base, fields: [] })).toMatch(/at least one/i);
    expect(validateReviewAction({ ...base, fields: [{ field: "profile.village", comment: " " }] })).toMatch(/comment/i);
    expect(
      validateReviewAction({ ...base, fields: [{ field: "a", comment: "x" }, { field: "a", comment: "y" }] }),
    ).toMatch(/only once/i);
    expect(validateReviewAction({ ...base, fields: [{ field: "profile.village", comment: " Check spelling " }] })).toMatchObject({
      fields: [{ field: "profile.village", comment: "Check spelling" }],
    });
  });

  it("rejects unknown actions, bad ids and bad versions", () => {
    expect(validateReviewAction({ id, action: "DELETE", version: 1 })).toMatch(/not available/i);
    expect(validateReviewAction({ id: "nope", action: "APPROVE", version: 1 })).toMatch(/identified/i);
    expect(validateReviewAction({ id, action: "APPROVE", version: 0 })).toMatch(/reload/i);
    expect(validateReviewAction({ id, action: "APPROVE", version: "3" })).toMatch(/reload/i);
    expect(validateReviewAction(null)).toBeTypeOf("string");
  });
});
