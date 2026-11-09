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
    // Issue #119: the Audits & AGM overview opens for their own societies; the files above stay hidden.
    expect(canViewCompliance(coordinator)).toBe(true);
  });

  it("gives the System Administrator no society data", () => {
    expect(visibleTo(systemAdmin)).toEqual([]);
    expect(canViewDocumentLibrary(systemAdmin)).toBe(false);
    expect(canViewCompliance(systemAdmin)).toBe(false);
    expect(complianceRecords.some((record) => canSeeSociety(systemAdmin, record))).toBe(false);
  });

  it("gives each role its V5 sidebar and leaves out pages it cannot open", () => {
    const labels = (viewer: ReturnType<typeof getViewer>) => {
      const { main, secondary } = navigationFor(viewer);
      return [...main, ...secondary].map((item) => item.label);
    };
    expect(labels(hq)).toEqual([
      "National Overview",
      "Map View",
      "District View",
      "Societies",
      "Review Queue",
      "Programmes",
      "Membership",
      "Audits",
      "Disaster & Emergency",
      "Requests & Tasks",
      "Reports",
      "Documents",
      "Administration",
      "Settings",
    ]);
    // V5 SP01, DD01, DM01 (DM04 from PR 7, Disaster response from PR 8).
    expect(labels(districtManager)).toEqual(["District Overview", "Societies", "Membership", "Audits", "Temporary DDM Access", "Disaster Response"]);
    expect(labels(coordinator)).toEqual(["Home", "My Societies", "Membership", "Audits", "Activities to Approve", "Disaster Response"]);
    expect(labels({ ...coordinator, role: "DEPUTY_DISTRICT_MANAGER" })).toEqual(["Home", "Societies", "Membership", "Audits", "Disaster Response"]);
    expect(labels(systemAdmin)).toEqual(["Platform Access", "Notifications"]);
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
