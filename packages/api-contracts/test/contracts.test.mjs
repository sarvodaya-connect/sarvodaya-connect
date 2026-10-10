import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_STATUSES,
  ACTIVITY_REPORT_STATUSES,
  API_ERROR_CODES,
  CORRECTION_STATUSES,
  DOCUMENT_STATUSES,
  REVIEW_DECISIONS,
  SOCIETY_STATUSES,
  SUBMISSION_STATUSES,
  USER_ROLES,
  VERIFICATION_STATUSES,
} from "../dist/index.js";

test("roles expose the three provisional access levels", () => {
  assert.deepEqual(USER_ROLES, [
    "SOCIETY_OFFICER",
    "DISTRICT_MANAGER",
    "HQ_ADMIN",
  ]);
});

test("workflow statuses include correction and resubmission states", () => {
  assert.ok(SUBMISSION_STATUSES.includes("CHANGES_REQUESTED"));
  assert.ok(SUBMISSION_STATUSES.includes("RESUBMITTED"));
  assert.deepEqual(ACTIVITY_REPORT_STATUSES, SUBMISSION_STATUSES);
});

test("all public enum collections contain unique values", () => {
  const collections = [
    ACCOUNT_STATUSES,
    API_ERROR_CODES,
    CORRECTION_STATUSES,
    DOCUMENT_STATUSES,
    REVIEW_DECISIONS,
    SOCIETY_STATUSES,
    SUBMISSION_STATUSES,
    USER_ROLES,
    VERIFICATION_STATUSES,
  ];

  for (const collection of collections) {
    assert.equal(new Set(collection).size, collection.length);
  }
});
