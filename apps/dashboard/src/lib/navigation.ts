import { canViewCompliance, canViewDocumentLibrary, type DemoViewer } from "./access";
import type { IconName } from "@/components/dashboard/icon";

export type NavigationItem = {
  href: string;
  icon: IconName;
  label: string;
  /** Other paths that belong to this item, such as the change log under Administration. */
  alsoActiveOn?: string[];
};

export type Navigation = { main: NavigationItem[]; secondary: NavigationItem[] };

/**
 * Prototype V5 sidebars (HQSide, SP01, DD01, DM01). Only pages that exist are
 * listed; the rest are added by the PR that builds them (see
 * docs/v5-implementation-plan.md). Pages a role cannot open are left out, but
 * the API still enforces every permission.
 */
export function navigationFor(viewer: DemoViewer): Navigation {
  switch (viewer.role) {
    case "HQ_ADMIN":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "National Overview", alsoActiveOn: ["/states"] },
          { href: "/map", icon: "map", label: "Map View" },
          { href: "/districts", icon: "chart", label: "District View" },
          { href: "/societies", icon: "people", label: "Societies" },
          { href: "/reviews", icon: "document", label: "Review Queue" },
          { href: "/activities", icon: "leaf", label: "Programmes" },
          { href: "/membership", icon: "personAdd", label: "Membership" },
          ...(canViewCompliance(viewer)
            ? [{ href: "/compliance", icon: "shield", label: "Audits" } satisfies NavigationItem]
            : []),
          { href: "/emergencies", icon: "alert", label: "Disaster & Emergency" },
          { href: "/requests", icon: "mail", label: "Requests & Tasks" },
          { href: "/reports", icon: "clipboard", label: "Reports" },
          ...(canViewDocumentLibrary(viewer)
            ? [{ href: "/documents", icon: "document", label: "Documents" } satisfies NavigationItem]
            : []),
        ],
        secondary: [
          { href: "/accounts", icon: "key", label: "Administration", alsoActiveOn: ["/audit"] },
        ],
      };
    // V5 SP01, DD01 and DM01 sidebars, with "Disaster response" (IR01, PR 8).
    case "PROGRAMME_COORDINATOR":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "Home" },
          { href: "/my-societies", icon: "list", label: "My societies", alsoActiveOn: ["/societies"] },
          { href: "/activities-to-approve", icon: "check", label: "Activities to approve" },
          { href: "/emergencies", icon: "alert", label: "Disaster response" },
        ],
        secondary: [],
      };
    case "DEPUTY_DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "Home" },
          { href: "/my-societies", icon: "list", label: "Societies", alsoActiveOn: ["/societies"] },
          { href: "/emergencies", icon: "alert", label: "Disaster response" },
        ],
        secondary: [],
      };
    case "DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "District overview" },
          { href: "/my-societies", icon: "list", label: "Societies", alsoActiveOn: ["/societies"] },
          { href: "/district-access", icon: "key", label: "Temporary DDM access" },
          { href: "/emergencies", icon: "alert", label: "Disaster response" },
        ],
        secondary: [],
      };
    case "SYSTEM_ADMIN":
      // Technical settings only: no society registry, district or review pages.
      return {
        main: [
          { href: "/admin", icon: "building", label: "Platform access" },
          { href: "/notifications", icon: "bell", label: "Notifications" },
        ],
        secondary: [],
      };
  }
}

export function isActiveItem(item: NavigationItem, pathname: string): boolean {
  return [item.href, ...(item.alsoActiveOn ?? [])].some((href) => {
    const path = href.split("?")[0]!;
    return pathname === path || (path !== "/dashboard" && pathname.startsWith(`${path}/`));
  });
}

const PAGE_TITLES: [prefix: string, title: string, subtitle?: string][] = [
  ["/admin", "Administration"],
  ["/accounts", "Accounts", "Users, roles, scopes and passwords"],
  ["/audit", "Change & access log", "Audit history"],
  ["/states", "Page states"],
  ["/societies/new", "Societies", "Create a society record"],
  ["/societies/", "Society record"],
  ["/societies", "Societies", "Search and filter every society"],
  ["/membership", "Membership", "Aggregated counts — no personal data"],
  ["/activities-to-approve", "Activities to approve", "Your assigned societies"],
  ["/activities", "Programmes & Activities", "Sarvodaya 10-sector approach"],
  ["/emergencies/", "Disaster response", "Live incident"],
  ["/emergencies", "Disaster response", "Open and follow incidents"],
  ["/districts", "District View", "Districts · active societies by A/B/C class"],
  ["/map", "Map View", "Every society, by A/B/C class and status"],
  ["/requests", "Requests & Tasks", "Ask districts and societies for documents or information"],
  ["/reports", "Reports", "Standard reports, ready to print or share"],
  ["/reviews", "Grade requests", "HQ approval queue"],
  ["/compliance", "Audits & AGM", "Audit report and the other annual Registrar documents"],
  ["/my-societies", "My societies"],
  ["/district-access", "Temporary DDM access"],
  ["/no-access", "No access"],
  ["/documents", "Documents", "Every certificate, minute and report in one place"],
  ["/search", "Search", "Societies, people, documents and records"],
  ["/notifications", "Alerts", "Requests, incidents, access and records"],
];

/** Header title and subtitle (V5 HQTop and the role headers). */
export function headingFor(pathname: string, viewer: DemoViewer): { title: string; subtitle: string } {
  const [, page, pageSubtitle] = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix)) ?? [];
  // V5 IR01: every role acts on incidents in its own scope, so no "view only" here.
  if (page === "Disaster response" && pageSubtitle) return { title: page, subtitle: pageSubtitle };
  switch (viewer.role) {
    case "HQ_ADMIN":
      return {
        title: page ?? "National Dashboard",
        subtitle: pageSubtitle ?? "Shramadana Societies Across Sri Lanka",
      };
    case "DISTRICT_MANAGER":
      // V5 DM02 calls the list "Societies": the DM sees the whole district.
      return {
        title: page === "My societies" ? "Societies" : (page ?? "District overview"),
        subtitle: `${viewer.scopeLabel.endsWith("District") ? viewer.scopeLabel : `${viewer.scopeLabel} District`} · view only`,
      };
    case "DEPUTY_DISTRICT_MANAGER":
      // V5 DD03 / DD04: "Societies", with their own and (with temporary access) the district.
      return { title: page === "My societies" ? "Societies" : (page ?? "Home"), subtitle: "Your assigned societies" };
    case "PROGRAMME_COORDINATOR":
      return {
        title: page ?? "Home",
        subtitle: page === "My societies" ? "Assigned societies · view and edit" : "Your assigned societies",
      };
    case "SYSTEM_ADMIN":
      return { title: page ?? "Administration", subtitle: "Technical settings only" };
  }
}

/** V5 header search placeholder: national for HQ, scoped for the other roles (SP01, DD01, DM01). */
export function searchPlaceholderFor(viewer: DemoViewer): string {
  switch (viewer.role) {
    case "HQ_ADMIN":
      return "Search societies by name, S number or district…";
    case "DISTRICT_MANAGER":
      return `Search ${viewer.scopeLabel} societies…`;
    case "DEPUTY_DISTRICT_MANAGER":
    case "PROGRAMME_COORDINATOR": {
      const count = viewer.societyIds?.length ?? 0;
      return count ? `Search your ${count} ${count === 1 ? "society" : "societies"}…` : "Search your societies…";
    }
    default:
      return "Search your societies…";
  }
}

/** Where the header search goes: HQ's national search, or the role's own society list. */
export function searchActionFor(viewer: DemoViewer): string {
  return viewer.role === "HQ_ADMIN" ? "/search" : "/my-societies";
}
