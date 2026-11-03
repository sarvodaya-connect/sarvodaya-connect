import { NextResponse, type NextRequest } from "next/server";

import { canOpen, noAccessPathFor, ROLE_COOKIE } from "@/lib/role-routes";

/**
 * V5 PR 6: SPCs, DDMs and DMs use the desktop too, but only their own pages.
 * Checked here on every navigation (a layout check would not re-run on
 * client-side navigation). It steers screens only: the API decides what data
 * each request may see, and HQ pages still check the role themselves.
 */
export function middleware(request: NextRequest) {
  if (canOpen(request.cookies.get(ROLE_COOKIE)?.value, request.nextUrl.pathname)) return NextResponse.next();
  // V5 M69d / ST04: say the page is for HQ instead of silently going home.
  // V5 D49f: a SarvoAI link says SarvoAI is for HQ only.
  return NextResponse.redirect(new URL(noAccessPathFor(request.nextUrl.pathname), request.url));
}

export const config = {
  // Pages only: not Next.js assets, files with an extension or route handlers under /api.
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
