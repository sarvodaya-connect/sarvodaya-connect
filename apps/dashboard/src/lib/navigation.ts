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
          { href: "/districts/kurunegala", icon: "chart", label: "District View", alsoActiveOn: ["/districts"] },
          { href: "/societies", icon: "people", label: "Societies" },
          { href: "/reviews", icon: "document", label: "Review Queue" },
          { href: "/activities", icon: "leaf", label: "Programmes" },
          { href: "/membership", icon: "personAdd", label: "Membership" },
          ...(canViewCompliance(viewer)
            ? [{ href: "/compliance", icon: "shield", label: "Audits" } satisfies NavigationItem]
            : []),
          { href: "/emergencies", icon: "alert", label: "Disaster & Emergency" },
          ...(canViewDocumentLibrary(viewer)
            ? [{ href: "/documents", icon: "document", label: "Documents" } satisfies NavigationItem]
            : []),
        ],
        secondary: [
          { href: "/accounts", icon: "key", label: "Administration", alsoActiveOn: ["/audit"] },
        ],
      };
    // V5 SP01, DD01 and DM01 sidebars. "Disaster response" joins with the role
    // incident pages (PR 8) and "Temporary DDM access" with PR 7.
    case "PROGRAMME_COORDINATOR":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "Home" },
          { href: "/my-societies", icon: "list", label: "My societies", alsoActiveOn: ["/societies"] },
          { href: "/activities-to-approve", icon: "check", label: "Activities to approve" },
        ],
        secondary: [],
      };
    case "DEPUTY_DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "Home" },
          { href: "/my-societies", icon: "list", label: "Societies", alsoActiveOn: ["/societies"] },
        ],
        secondary: [],
      };
    case "DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "District overview" },
          { href: "/my-societies", icon: "list", label: "Societies", alsoActiveOn: ["/societies"] },
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
  ["/societies", "Societies"],
  ["/membership", "Membership"],
  ["/activities", "Programmes and activities"],
  ["/emergencies", "Disaster & Emergency"],
  ["/districts", "District view"],
  ["/reviews", "Grade requests", "HQ approval queue"],
  ["/compliance", "Audits & AGM", "Audit report and the other annual Registrar documents"],
  ["/activities-to-approve", "Activities to approve", "Your assigned societies"],
  ["/my-societies", "My societies"],
  ["/documents", "Documents", "Every certificate, minute and report in one place"],
  ["/search", "Search"],
  ["/notifications", "Alerts"],
];

/** Header title and subtitle (V5 HQTop and the role headers). */
export function headingFor(pathname: string, viewer: DemoViewer): { title: string; subtitle: string } {
  const [, page, pageSubtitle] = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix)) ?? [];
  switch (viewer.role) {
    case "HQ_ADMIN":
      return {
        title: page ?? "National overview",
        subtitle: pageSubtitle ?? "Sarvodaya societies across Sri Lanka",
      };
    case "DISTRICT_MANAGER":
      // V5 DM02 calls the list "Societies": the DM sees the whole district.
      return {
        title: page === "My societies" ? "Societies" : (page ?? "District overview"),
        subtitle: `${viewer.scopeLabel.endsWith("District") ? viewer.scopeLabel : `${viewer.scopeLabel} District`} · view only`,
      };
    case "DEPUTY_DISTRICT_MANAGER":
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
