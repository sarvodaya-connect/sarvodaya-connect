import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  AUTH_PROVIDERS,
  ACTIVITY_REPORT_STATUSES,
  EMERGENCY_ACTION_STATUSES,
  EMERGENCY_INCIDENT_STATUSES,
  EMERGENCY_INCIDENT_TYPES,
  EMERGENCY_RECORD_STATUSES,
  EMERGENCY_SEVERITIES,
  API_ERROR_CODES,
  CORRECTION_STATUSES,
  DOCUMENT_STATUSES,
  MEMBERSHIP_CATEGORIES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  REVIEW_DECISIONS,
  SOCIETY_STATUSES,
  SUBMISSION_STATUSES,
  USER_ROLES,
  VERIFICATION_STATUSES,
  hasPermission,
} from "../dist/index.js";

test("roles expose the provisional access levels", () => {
  assert.deepEqual(USER_ROLES, [
    "SOCIETY_OFFICER",
    "DISTRICT_MANAGER",
    "DEPUTY_DISTRICT_MANAGER",
    "PROGRAMME_COORDINATOR",
    "HQ_ADMIN",
  ]);
});

test("auth providers and account types are explicit and unique", () => {
  assert.deepEqual(AUTH_PROVIDERS, ["DEMO", "COGNITO"]);
  assert.deepEqual(ACCOUNT_TYPES, ["PERSON", "SERVICE"]);
  assert.equal(new Set(PERMISSIONS).size, PERMISSIONS.length);
});

test("role permissions grant expected capabilities without cross-role escalation", () => {
  assert.ok(hasPermission(["SOCIETY_OFFICER"], "SOCIETY_UPDATE"));
  assert.ok(hasPermission(["DISTRICT_MANAGER"], "SUBMISSION_REVIEW"));
  assert.ok(hasPermission(["SOCIETY_OFFICER"], "EMERGENCY_ASSESS"));
  assert.ok(hasPermission(["PROGRAMME_COORDINATOR"], "EMERGENCY_COORDINATE"));
  assert.ok(hasPermission(["HQ_ADMIN"], "EMERGENCY_ACTIVATE"));
  assert.ok(hasPermission(["HQ_ADMIN"], "PLATFORM_ADMIN"));
  assert.equal(hasPermission(["SOCIETY_OFFICER"], "PLATFORM_ADMIN"), false);
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS), USER_ROLES);
});

test("workflow statuses include correction and resubmission states", () => {
  assert.ok(SUBMISSION_STATUSES.includes("CHANGES_REQUESTED"));
  assert.ok(SUBMISSION_STATUSES.includes("RESUBMITTED"));
  assert.deepEqual(ACTIVITY_REPORT_STATUSES, SUBMISSION_STATUSES);
});

test("all public enum collections contain unique values", () => {
  const collections = [
    ACCOUNT_STATUSES,
    ACCOUNT_TYPES,
    AUTH_PROVIDERS,
    API_ERROR_CODES,
    CORRECTION_STATUSES,
    DOCUMENT_STATUSES,
    EMERGENCY_ACTION_STATUSES,
    EMERGENCY_INCIDENT_STATUSES,
    EMERGENCY_INCIDENT_TYPES,
    EMERGENCY_RECORD_STATUSES,
    EMERGENCY_SEVERITIES,
    MEMBERSHIP_CATEGORIES,
    PERMISSIONS,
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
