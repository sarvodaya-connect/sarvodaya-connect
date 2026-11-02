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
    case "PROGRAMME_COORDINATOR":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: "Home" },
          { href: "/societies", icon: "list", label: "My societies" },
          { href: "/emergencies", icon: "alert", label: "Disaster response" },
        ],
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

const PAGE_TITLES: [prefix: string, title: string][] = [
  ["/admin", "Administration"],
  ["/accounts", "Administration"],
  ["/audit", "Change & access log"],
  ["/states", "Page states"],
  ["/societies/", "Society record"],
  ["/societies", "Societies"],
  ["/membership", "Membership"],
  ["/activities", "Programmes and activities"],
  ["/emergencies", "Disaster & Emergency"],
  ["/districts", "District view"],
  ["/reviews", "Review queue"],
  ["/compliance", "Audits and AGM"],
  ["/documents", "Documents"],
  ["/search", "Search"],
  ["/notifications", "Alerts"],
];

/** Header title and subtitle (V5 HQTop and the role headers). */
export function headingFor(pathname: string, viewer: DemoViewer): { title: string; subtitle: string } {
  const page = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1];
  switch (viewer.role) {
    case "HQ_ADMIN":
      return { title: page ?? "National overview", subtitle: "Sarvodaya societies across Sri Lanka" };
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
