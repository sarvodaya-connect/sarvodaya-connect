/**
 * Provisional role-based visibility rules for the dashboard (SC-48).
 *
 * Based on the provisional permissions agreed for the MVP:
 * - HQ Administrator: every district (national).
 * - District Manager: societies in their own district.
 * - Social Programme Coordinator (Phase 2): only their assigned societies,
 *   and no audit, Registrar or finance documents.
 * - System Administrator: technical settings only, no society data.
 * - The signed members list is visible to District Managers and HQ only.
 *
 * The rules are applied on the server before data is sent to the browser.
 * They are a demonstration of the agreed rules; the API will enforce them
 * when real data and Amazon Cognito sign-in are connected.
 */

export type DashboardRole =
  | "HQ_ADMIN"
  | "DISTRICT_MANAGER"
  | "PROGRAMME_COORDINATOR"
  | "SYSTEM_ADMIN";

export type DemoViewer = {
  id: string;
  displayName: string;
  initials: string;
  role: DashboardRole;
  roleLabel: string;
  scopeLabel: string;
  /** Districts the viewer can see. "ALL" means national access. */
  districtIds: "ALL" | string[];
  /** Coordinators only see the societies assigned to them. */
  societyIds?: string[];
};

/** Fictional dashboard users for the demonstration role switcher. */
export const demoViewers: DemoViewer[] = [
  {
    id: "hq-admin",
    displayName: "K. Fernando",
    initials: "KF",
    role: "HQ_ADMIN",
    roleLabel: "HQ Administrator",
    scopeLabel: "All districts",
    districtIds: "ALL",
  },
  {
    id: "district-manager",
    displayName: "R. Fernando",
    initials: "RF",
    role: "DISTRICT_MANAGER",
    roleLabel: "District Manager",
    scopeLabel: "Kurunegala District",
    districtIds: ["district-kurunegala"],
  },
  {
    id: "programme-coordinator",
    displayName: "P. Wickramasinghe",
    initials: "PW",
    role: "PROGRAMME_COORDINATOR",
    roleLabel: "Programme Coordinator",
    scopeLabel: "3 assigned societies",
    districtIds: [],
    societyIds: ["society-pahala-kosgama", "society-wellawa", "society-rambukkana"],
  },
  {
    id: "system-admin",
    displayName: "T. Silva",
    initials: "TS",
    role: "SYSTEM_ADMIN",
    roleLabel: "System Administrator",
    scopeLabel: "Technical settings only",
    districtIds: [],
  },
];

export const DEFAULT_VIEWER_ID = "hq-admin";

/** Cookie that remembers which demonstration user is viewing the dashboard. */
export const DEMO_VIEWER_COOKIE = "sc_demo_viewer";

export function getViewer(id: string | undefined | null): DemoViewer {
  return demoViewers.find((viewer) => viewer.id === id) ?? demoViewers[0]!;
}

/** Roles allowed to open the signed members list and other reviewer-only files. */
const REVIEWER_ROLES: DashboardRole[] = ["HQ_ADMIN", "DISTRICT_MANAGER"];

export type ScopedRecord = { societyId: string; districtId: string };

/** Whether a society's records are inside the viewer's scope at all. */
export function canSeeSociety(viewer: DemoViewer, record: ScopedRecord): boolean {
  switch (viewer.role) {
    case "HQ_ADMIN":
      return true;
    case "DISTRICT_MANAGER":
      return viewer.districtIds === "ALL" || viewer.districtIds.includes(record.districtId);
    case "PROGRAMME_COORDINATOR":
      return viewer.societyIds?.includes(record.societyId) ?? false;
    case "SYSTEM_ADMIN":
      return false;
  }
}

/** D11 Audits & compliance: HQ and District Managers only. */
export function canViewCompliance(viewer: DemoViewer): boolean {
  return REVIEWER_ROLES.includes(viewer.role);
}

/** D12 Documents library: everyone except the System Administrator. */
export function canViewDocumentLibrary(viewer: DemoViewer): boolean {
  return viewer.role !== "SYSTEM_ADMIN";
}

/** D15/D20 Reports: available to society-data roles, but not System Admin. */
export function canViewReports(viewer: DemoViewer): boolean {
  return viewer.role !== "SYSTEM_ADMIN";
}

export type DocumentCategory = "REGISTRAR" | "FINANCE" | "GENERAL";

export type ProtectedDocument = ScopedRecord & {
  category: DocumentCategory;
  /** The signed members list: District Managers and HQ only. */
  reviewersOnly?: boolean;
};

export function canViewDocument(viewer: DemoViewer, document: ProtectedDocument): boolean {
  if (!canViewDocumentLibrary(viewer) || !canSeeSociety(viewer, document)) return false;
  if (document.reviewersOnly && !REVIEWER_ROLES.includes(viewer.role)) return false;
  if (viewer.role === "PROGRAMME_COORDINATOR" && document.category !== "GENERAL") return false;
  return true;
}

export type NotificationAudience = {
  roles: DashboardRole[];
  /** When set, District Managers only see it for these districts. */
  districtIds?: string[];
  /** When set, coordinators only see it if one of these societies is assigned to them. */
  societyIds?: string[];
};

export function canSeeNotification(viewer: DemoViewer, audience: NotificationAudience): boolean {
  if (!audience.roles.includes(viewer.role)) return false;
  if (viewer.role === "DISTRICT_MANAGER" && audience.districtIds && viewer.districtIds !== "ALL") {
    const allowed = viewer.districtIds;
    return audience.districtIds.some((id) => allowed.includes(id));
  }
  if (viewer.role === "PROGRAMME_COORDINATOR" && audience.societyIds) {
    return audience.societyIds.some((id) => viewer.societyIds?.includes(id));
  }
  return true;
}
