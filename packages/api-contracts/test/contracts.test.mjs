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

test("society record grades, grade requests and history categories are explicit", async () => {
  const {
    GRADE_DECISIONS,
    GRADE_REQUEST_STATUSES,
    SOCIETY_GRADES,
    SOCIETY_GRADE_LABELS,
    SOCIETY_HISTORY_CATEGORIES,
  } = await import("../dist/index.js");
  assert.deepEqual(SOCIETY_GRADES, ["A", "B", "C"]);
  assert.deepEqual(Object.keys(SOCIETY_GRADE_LABELS), SOCIETY_GRADES);
  assert.deepEqual(GRADE_REQUEST_STATUSES, ["PENDING", "APPROVED", "REJECTED"]);
  assert.deepEqual(GRADE_DECISIONS, ["APPROVE", "REJECT"]);
  assert.equal(new Set(SOCIETY_HISTORY_CATEGORIES).size, SOCIETY_HISTORY_CATEGORIES.length);
  assert.ok(SOCIETY_HISTORY_CATEGORIES.includes("ANNUAL_SUMMARY"));
});

test("Village Economic Profile catalogue is consistent (issue #145)", async () => {
  const economy = await import("../dist/index.js");
  const units = new Map(economy.PRODUCTION_UNITS.map((unit) => [unit.code, unit.decimals]));
  const codes = economy.ECONOMY_PRODUCTS.map((product) => product.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const product of economy.ECONOMY_PRODUCTS) {
    if (product.code === "OTHER") {
      assert.equal(product.unit, null);
      continue;
    }
    assert.ok(units.has(product.unit), `${product.code} has a known unit`);
    assert.ok(economy.ECONOMY_INDUSTRIES.includes(product.industry), `${product.code} has a known industry`);
  }
  // Count units are whole numbers; services are counted in jobs.
  for (const code of ["ITEM", "NUT", "EGG", "PACKET", "JOB"]) assert.equal(units.get(code), 0);
  assert.equal(economy.ECONOMY_PRODUCTS.find((p) => p.code === "TAILORING_JOBS").kind, "SERVICE");
  assert.deepEqual(economy.PRODUCTION_MEASUREMENTS, ["ACTUAL", "ESTIMATED"]);
  assert.deepEqual(economy.PRODUCTION_BASES, ["WEEKLY", "MONTHLY", "SEASONAL"]);
  assert.deepEqual(economy.BUSINESS_STATUSES, ["OPERATING", "SEASONAL", "TEMPORARILY_STOPPED", "CLOSED"]);
});
