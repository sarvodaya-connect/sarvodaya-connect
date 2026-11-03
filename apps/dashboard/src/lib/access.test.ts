import { describe, expect, it } from "vitest";

import { navigationFor } from "@/lib/navigation";

import {
  canSeeSociety,
  canViewCompliance,
  canViewDocument,
  canViewDocumentLibrary,
  getViewer,
} from "./access";
import { complianceRecords } from "./demo-compliance";
import { libraryDocuments } from "./demo-documents";
import { notificationsFor } from "./demo-notifications";

const hq = getViewer("hq-admin");
const districtManager = getViewer("district-manager");
const coordinator = getViewer("programme-coordinator");
const systemAdmin = getViewer("system-admin");

const visibleTo = (viewer: ReturnType<typeof getViewer>) =>
  libraryDocuments.filter((document) => canViewDocument(viewer, document));

describe("provisional role-based visibility", () => {
  it("falls back to the HQ Administrator for an unknown or missing viewer", () => {
    expect(getViewer(undefined).role).toBe("HQ_ADMIN");
    expect(getViewer("not-a-user").role).toBe("HQ_ADMIN");
  });

  it("lets HQ see every society and every document, including signed members lists", () => {
    expect(complianceRecords.every((record) => canSeeSociety(hq, record))).toBe(true);
    expect(visibleTo(hq)).toHaveLength(libraryDocuments.length);
    expect(visibleTo(hq).some((document) => document.reviewersOnly)).toBe(true);
  });

  it("limits a District Manager to their own district", () => {
    const documents = visibleTo(districtManager);
    expect(documents.length).toBeGreaterThan(0);
    expect(new Set(documents.map((document) => document.districtName))).toEqual(new Set(["Kurunegala"]));
    expect(documents.some((document) => document.reviewersOnly)).toBe(true);
    expect(complianceRecords.filter((record) => canSeeSociety(districtManager, record))).toHaveLength(4);
  });

  it("hides Registrar, finance and members-list files from programme coordinators", () => {
    const documents = visibleTo(coordinator);
    expect(documents.map((document) => document.title).sort()).toEqual([
      "Children's library opening photos",
      "Registration certificate",
      "Tank cleaning photos",
    ]);
    expect(documents.every((document) => document.category === "GENERAL")).toBe(true);
    expect(documents.some((document) => document.reviewersOnly)).toBe(false);
    expect(canViewCompliance(coordinator)).toBe(false);
  });

  it("gives the System Administrator no society data", () => {
    expect(visibleTo(systemAdmin)).toEqual([]);
    expect(canViewDocumentLibrary(systemAdmin)).toBe(false);
    expect(canViewCompliance(systemAdmin)).toBe(false);
    expect(complianceRecords.some((record) => canSeeSociety(systemAdmin, record))).toBe(false);
  });

  it("only sends each role the notifications meant for it", () => {
    expect(notificationsFor(hq)).toHaveLength(9);
    expect(notificationsFor(districtManager).map((notification) => notification.id)).toEqual([
      "note-review-queue",
      "note-registrar-kurunegala",
      "note-activity-evidence",
      "note-audit-overdue-kurunegala",
      "note-returned-wellawa",
    ]);
    expect(notificationsFor(coordinator).map((notification) => notification.id)).toEqual([
      "note-activity-evidence",
      "note-library-approved",
    ]);
    expect(notificationsFor(systemAdmin).map((notification) => notification.category)).toEqual(["SYSTEM", "SYSTEM"]);
  });

  it("gives each role its V5 sidebar and leaves out pages it cannot open", () => {
    const labels = (viewer: ReturnType<typeof getViewer>) => {
      const { main, secondary } = navigationFor(viewer);
      return [...main, ...secondary].map((item) => item.label);
    };
    expect(labels(hq)).toEqual([
      "National Overview",
      "District View",
      "Societies",
      "Review Queue",
      "Programmes",
      "Membership",
      "Audits",
      "Disaster & Emergency",
      "Documents",
      "Administration",
    ]);
    // V5 SP01, DD01, DM01 (and DM04 from PR 7). Disaster response joins in PR 8.
    expect(labels(districtManager)).toEqual(["District overview", "Societies", "Temporary DDM access"]);
    expect(labels(coordinator)).toEqual(["Home", "My societies", "Activities to approve"]);
    expect(labels({ ...coordinator, role: "DEPUTY_DISTRICT_MANAGER" })).toEqual(["Home", "Societies"]);
    expect(labels(systemAdmin)).toEqual(["Platform access", "Notifications"]);
  });

  it("only gives HQ the administration pages", () => {
    for (const viewer of [districtManager, coordinator, systemAdmin]) {
      const hrefs = [...navigationFor(viewer).main, ...navigationFor(viewer).secondary].map((item) => item.href);
      expect(hrefs).not.toContain("/accounts");
    }
  });

  it("keeps Deputy District Managers to their assigned societies", () => {
    const ddm = { ...coordinator, role: "DEPUTY_DISTRICT_MANAGER" as const };
    expect(canSeeSociety(ddm, { societyId: "society-wellawa", districtId: "district-kurunegala" })).toBe(true);
    expect(canSeeSociety(ddm, { societyId: "society-thalawa", districtId: "district-kurunegala" })).toBe(false);
  });

});
