import { canViewCompliance, canViewDocumentLibrary, type DemoViewer } from "./access";
import type { IconName } from "@/components/dashboard/icon";
import { en, type MessageKey } from "@/i18n/messages/en";
import { createTranslator, type Translator } from "@/i18n/translate";

const ENGLISH = createTranslator(en, "en");

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
export function navigationFor(viewer: DemoViewer, t: Translator = ENGLISH): Navigation {
  switch (viewer.role) {
    case "HQ_ADMIN":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: t("nav.nationalOverview"), alsoActiveOn: ["/states"] },
          { href: "/map", icon: "map", label: t("nav.mapView") },
          { href: "/districts", icon: "chart", label: t("nav.districtView") },
          { href: "/societies", icon: "people", label: t("nav.societies") },
          { href: "/reviews", icon: "document", label: t("nav.reviewQueue") },
          { href: "/activities", icon: "leaf", label: t("nav.programmes") },
          { href: "/membership", icon: "personAdd", label: t("nav.membership") },
          ...(canViewCompliance(viewer)
            ? [{ href: "/compliance", icon: "shield", label: t("nav.audits") } satisfies NavigationItem]
            : []),
          { href: "/emergencies", icon: "alert", label: t("nav.disasterEmergency") },
          { href: "/requests", icon: "mail", label: t("nav.requestsTasks") },
          { href: "/reports", icon: "clipboard", label: t("nav.reports") },
          ...(canViewDocumentLibrary(viewer)
            ? [{ href: "/documents", icon: "document", label: t("nav.documents") } satisfies NavigationItem]
            : []),
        ],
        secondary: [
          { href: "/accounts", icon: "key", label: t("nav.administration"), alsoActiveOn: ["/audit"] },
          { href: "/settings", icon: "settings", label: t("nav.settings") },
        ],
      };
    // V5 SP01, DD01 and DM01 sidebars, with "Disaster response" (IR01, PR 8).
    case "PROGRAMME_COORDINATOR":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: t("nav.home") },
          { href: "/my-societies", icon: "list", label: t("nav.mySocieties"), alsoActiveOn: ["/societies"] },
          { href: "/membership", icon: "personAdd", label: t("nav.membership") },
          { href: "/activities-to-approve", icon: "check", label: t("nav.activitiesToApprove") },
          { href: "/activities", icon: "leaf", label: t("nav.programmes") },
          { href: "/emergencies", icon: "alert", label: t("nav.disasterResponse") },
        ],
        secondary: [],
      };
    case "DEPUTY_DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: t("nav.home") },
          { href: "/my-societies", icon: "list", label: t("nav.societies"), alsoActiveOn: ["/societies"] },
          { href: "/membership", icon: "personAdd", label: t("nav.membership") },
          { href: "/activities", icon: "leaf", label: t("nav.programmes") },
          { href: "/emergencies", icon: "alert", label: t("nav.disasterResponse") },
        ],
        secondary: [],
      };
    case "DISTRICT_MANAGER":
      return {
        main: [
          { href: "/dashboard", icon: "home", label: t("nav.districtOverview") },
          { href: "/my-societies", icon: "list", label: t("nav.societies"), alsoActiveOn: ["/societies"] },
          { href: "/membership", icon: "personAdd", label: t("nav.membership") },
          { href: "/activities", icon: "leaf", label: t("nav.programmes") },
          { href: "/district-access", icon: "key", label: t("nav.temporaryDdmAccess") },
          { href: "/emergencies", icon: "alert", label: t("nav.disasterResponse") },
        ],
        secondary: [],
      };
    case "SYSTEM_ADMIN":
      // Technical settings only: no society registry, district or review pages.
      return {
        main: [
          { href: "/admin", icon: "building", label: t("nav.platformAccess") },
          { href: "/notifications", icon: "bell", label: t("nav.notifications") },
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

const PAGE_TITLES: [prefix: string, title: MessageKey, subtitle?: MessageKey][] = [
  ["/admin", "nav.administration"],
  ["/accounts", "page.accounts", "sub.accounts"],
  ["/audit", "page.changeAccessLog", "sub.audit"],
  ["/states", "page.pageStates"],
  ["/societies/new", "nav.societies", "sub.newSociety"],
  ["/societies/", "page.societyRecord"],
  ["/societies", "nav.societies", "sub.societies"],
  ["/membership", "nav.membership", "sub.membership"],
  ["/activities-to-approve", "nav.activitiesToApprove", "sub.assignedSocieties"],
  ["/activities", "page.programmesActivities", "sub.tenSector"],
  ["/emergencies/", "nav.disasterResponse", "sub.liveIncident"],
  ["/emergencies", "nav.disasterResponse", "sub.openFollowIncidents"],
  ["/districts", "nav.districtView", "sub.districts"],
  ["/map", "nav.mapView", "sub.map"],
  ["/requests", "nav.requestsTasks", "sub.requests"],
  ["/reports", "nav.reports", "sub.reports"],
  ["/reviews", "page.gradeRequests", "sub.reviews"],
  ["/compliance", "page.auditsAgm", "sub.compliance"],
  ["/my-societies", "nav.mySocieties"],
  ["/district-access", "nav.temporaryDdmAccess"],
  ["/no-access", "page.noAccess"],
  ["/documents", "nav.documents", "sub.documents"],
  ["/settings", "nav.settings", "sub.settings"],
  ["/sarvoai", "shell.sarvoai", "sub.sarvoai"],
  ["/search", "page.search", "sub.search"],
  ["/notifications", "page.alerts", "sub.notifications"],
];

/** Header title and subtitle (V5 HQTop and the role headers). */
export function headingFor(pathname: string, viewer: DemoViewer, t: Translator = ENGLISH): { title: string; subtitle: string } {
  const [, page, pageSubtitle] = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix)) ?? [];
  const title = (fallback: MessageKey) => t(page ?? fallback);
  // V5 IR01: every role acts on incidents in its own scope, so no "view only" here.
  if (page === "nav.disasterResponse" && pageSubtitle) return { title: t(page), subtitle: t(pageSubtitle) };
  // V5 DM02, DD03 and DD04 call the list "Societies": they reach beyond their own.
  const listTitle = (fallback: MessageKey) => (page === "nav.mySocieties" ? t("nav.societies") : title(fallback));
  switch (viewer.role) {
    case "HQ_ADMIN":
      return { title: title("page.nationalDashboard"), subtitle: t(pageSubtitle ?? "sub.national") };
    case "DISTRICT_MANAGER":
      return {
        title: listTitle("nav.districtOverview"),
        subtitle: t("sub.districtViewOnly", { district: t("scope.district", { name: viewer.scopeLabel.replace(/ District$/, "") }) }),
      };
    case "DEPUTY_DISTRICT_MANAGER":
      return { title: listTitle("nav.home"), subtitle: t("sub.assignedSocieties") };
    case "PROGRAMME_COORDINATOR":
      return { title: title("nav.home"), subtitle: t(page === "nav.mySocieties" ? "sub.assignedEdit" : "sub.assignedSocieties") };
    case "SYSTEM_ADMIN":
      return { title: title("nav.administration"), subtitle: t("sub.technical") };
  }
}

/** V5 header search placeholder: national for HQ, scoped for the other roles (SP01, DD01, DM01). */
export function searchPlaceholderFor(viewer: DemoViewer, t: Translator = ENGLISH): string {
  switch (viewer.role) {
    case "HQ_ADMIN":
      return t("search.national");
    case "DISTRICT_MANAGER":
      return t("search.district", { district: viewer.scopeLabel });
    case "DEPUTY_DISTRICT_MANAGER":
    case "PROGRAMME_COORDINATOR": {
      const count = viewer.societyIds?.length ?? 0;
      return count ? t.plural("search.yours", count) : t("search.yoursPlain");
    }
    default:
      return t("search.yoursPlain");
  }
}

/** Where the header search goes: HQ's national search, or the role's own society list. */
export function searchActionFor(viewer: DemoViewer): string {
  return viewer.role === "HQ_ADMIN" ? "/search" : "/my-societies";
}
