import { NextResponse, type NextRequest } from "next/server";

import { authMode, cognitoConfig, cognitoRefresh } from "@/lib/cognito";
import { canOpen, noAccessPathFor, ROLE_COOKIE } from "@/lib/role-routes";
import { REFRESH_COOKIE, SESSION_COOKIE, sessionCookie, SIGN_IN_SECONDS } from "@/lib/session-cookies";

/**
 * Cognito sign-in: the access token cookie ends a minute before the token
 * does. When it has gone, a new one is fetched with the refresh token, for this
 * request and the browser. If Cognito refuses (signed out, password reset,
 * disabled, or past the refresh token's life), every sign-in cookie is removed
 * and the page sends the person to sign in.
 */
async function refreshed(request: NextRequest): Promise<NextResponse | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken || request.cookies.has(SESSION_COOKIE)) return null;
  try {
    if (authMode() !== "cognito") return null;
    const tokens = await cognitoRefresh(cognitoConfig(), refreshToken);
    const seconds = Math.max(60, Math.min(tokens.expiresIn - 60, SIGN_IN_SECONDS));
    request.cookies.set(SESSION_COOKIE, tokens.accessToken);
    const response = NextResponse.next({ request });
    response.cookies.set(SESSION_COOKIE, tokens.accessToken, sessionCookie(seconds));
    return response;
  } catch {
    request.cookies.delete(REFRESH_COOKIE);
    request.cookies.delete(ROLE_COOKIE);
    const response = NextResponse.next({ request });
    response.cookies.delete(REFRESH_COOKIE);
    response.cookies.delete(ROLE_COOKIE);
    return response;
  }
}

/**
 * V5 PR 6: SPCs, DDMs and DMs use the desktop too, but only their own pages.
 * Checked here on every navigation (a layout check would not re-run on
 * client-side navigation). It steers screens only: the API decides what data
 * each request may see, and HQ pages still check the role themselves.
 */
export async function middleware(request: NextRequest) {
  if (!canOpen(request.cookies.get(ROLE_COOKIE)?.value, request.nextUrl.pathname)) {
    // V5 M69d / ST04: say the page is for HQ instead of silently going home.
    // V5 D49f: a SarvoAI link says SarvoAI is for HQ only.
    return NextResponse.redirect(new URL(noAccessPathFor(request.nextUrl.pathname), request.url));
  }
  return (await refreshed(request)) ?? NextResponse.next();
}

export const config = {
  // Pages only: not Next.js assets, files with an extension or route handlers under /api.
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
