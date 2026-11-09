/**
 * V5 PR 6: the desktop pages SPCs, DDMs and DMs may open. HQ (and anyone not
 * yet signed in) is not limited here; HQ pages check the role themselves and
 * the API decides what data each request may see.
 */
export const ROLE_COOKIE = "sc_role";

const FIELD_ROLES = new Set(["PROGRAMME_COORDINATOR", "DEPUTY_DISTRICT_MANAGER", "DISTRICT_MANAGER"]);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FIELD_PATHS = [
  /^\/$/,
  /^\/dashboard$/,
  /^\/my-societies$/,
  // Issue #118: Membership for the user's own scope; the API limits the figures.
  /^\/membership$/,
  new RegExp(`^/societies/${UUID}(/.*)?$`, "i"),
  /^\/activities-to-approve(\/.*)?$/,
  /^\/district-access$/,
  // V5 PR 8: disaster response (IR01–IR05). The API limits each incident to the user's scope.
  new RegExp(`^/emergencies(/${UUID})?$`, "i"),
  /^\/no-access$/,
];

/** V5 M69d / D49f: which no-access page a refused path shows. */
export function noAccessPathFor(pathname: string) {
  return pathname.startsWith("/sarvoai") ? "/no-access?page=sarvoai" : "/no-access?page=hq";
}

export function canOpen(role: string | undefined, pathname: string): boolean {
  if (!role || !FIELD_ROLES.has(role)) return true;
  return FIELD_PATHS.some((pattern) => pattern.test(pathname));
}
