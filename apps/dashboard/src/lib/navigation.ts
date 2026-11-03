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
    case "PROGRAMME_COORDINATOR":
      // V5 SP01 order. Home, My societies and Disaster response join in PR 6
      // when the SPC desktop opens; only the PR 4 approval pages exist today.
      return {
        main: [{ href: "/activities-to-approve", icon: "check", label: "Activities to approve" }],
        secondary: [],
      };
    case "DEPUTY_DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "Home" },
          { href: "/societies", icon: "list", label: "Societies" },
          { href: "/emergencies", icon: "alert", label: "Disaster response" },
        ],
        secondary: [],
      };
    case "DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "District overview" },
          { href: "/societies", icon: "list", label: "Societies" },
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
  ["/emergencies", "Disaster & Emergency"],
  ["/districts", "District View", "Districts · active societies by A/B/C class"],
  ["/map", "Map View", "Every society, by A/B/C class and status"],
  ["/requests", "Requests & Tasks", "Ask districts and societies for documents or information"],
  ["/reports", "Reports", "Standard reports, ready to print or share"],
  ["/reviews", "Grade requests", "HQ approval queue"],
  ["/compliance", "Audits & AGM", "Audit report and the other annual Registrar documents"],
  ["/documents", "Documents", "Every certificate, minute and report in one place"],
  ["/search", "Search", "Societies, people, documents and records"],
  ["/notifications", "Alerts", "Requests, incidents, access and records"],
];

/** Header title and subtitle (V5 HQTop and the role headers). */
export function headingFor(pathname: string, viewer: DemoViewer): { title: string; subtitle: string } {
  const [, page, pageSubtitle] = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix)) ?? [];
  switch (viewer.role) {
    case "HQ_ADMIN":
      return {
        title: page ?? "National Dashboard",
        subtitle: pageSubtitle ?? "Shramadana Societies Across Sri Lanka",
      };
    case "DISTRICT_MANAGER":
      return { title: page ?? "District overview", subtitle: `${viewer.scopeLabel} · view only` };
    case "DEPUTY_DISTRICT_MANAGER":
    case "PROGRAMME_COORDINATOR":
      return { title: page ?? "Home", subtitle: "Your assigned societies" };
    case "SYSTEM_ADMIN":
      return { title: page ?? "Administration", subtitle: "Technical settings only" };
  }
}

/** V5 header search placeholder: national for HQ, scoped for the other roles. */
export function searchPlaceholderFor(viewer: DemoViewer): string {
  return viewer.role === "HQ_ADMIN"
    ? "Search societies by name, S number or district…"
    : "Search your societies…";
}
