import { describe, expect, it } from "vitest";

import { navigationFor } from "@/components/dashboard/dashboard-shell";

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

  it("leaves pages a role cannot open out of the navigation", () => {
    const labels = (viewer: ReturnType<typeof getViewer>) => navigationFor(viewer).map((item) => item.label);
    expect(labels(hq)).toEqual(expect.arrayContaining(["Audits & compliance", "Documents", "Notifications"]));
    expect(labels(districtManager)).toEqual(expect.arrayContaining(["Audits & compliance", "Documents"]));
    expect(labels(coordinator)).not.toContain("Audits & compliance");
    expect(labels(coordinator)).toContain("Documents");
    expect(labels(systemAdmin)).not.toContain("Documents");
    expect(labels(systemAdmin)).toContain("Notifications");
  });
});
