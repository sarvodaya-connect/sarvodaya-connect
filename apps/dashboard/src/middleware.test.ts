// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { middleware } from "./middleware";

const page = (cookies: Record<string, string>, path = "/dashboard") =>
  new NextRequest(`http://localhost${path}`, { headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") } });

describe("middleware: Cognito access token refresh", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AUTH_PROVIDER", "cognito");
    vi.stubEnv("COGNITO_USER_POOL_ID", "ap-southeast-1_Fictional1");
    vi.stubEnv("COGNITO_CLIENT_ID", "fictionalclient1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("gets a new access token when the old one has gone, for this request and the browser", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ AuthenticationResult: { AccessToken: "new.access.token", ExpiresIn: 3600 } })));
    const response = await middleware(page({ sc_refresh: "fictional-refresh", sc_role: "HQ_ADMIN" }));
    const cookie = response.cookies.get("sc_session");
    expect(cookie).toMatchObject({ value: "new.access.token", httpOnly: true, maxAge: 3540 });
    // Server components in this request see the new token too.
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sc_session=new.access.token");
  });

  it("does nothing while the access token is still there", async () => {
    await middleware(page({ sc_session: "a.b.c", sc_refresh: "fictional-refresh" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("when Cognito refuses the refresh token, removes the sign-in so the page asks to sign in", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ __type: "NotAuthorizedException", message: "Refresh Token has been revoked" }), { status: 400 }));
    const response = await middleware(page({ sc_refresh: "revoked", sc_role: "HQ_ADMIN" }));
    expect(response.cookies.get("sc_refresh")?.value).toBe("");
    expect(response.cookies.get("sc_role")?.value).toBe("");
    expect(response.cookies.get("sc_session")).toBeUndefined();
  });

  it("local development never calls Cognito", async () => {
    vi.stubEnv("AUTH_PROVIDER", "local");
    await middleware(page({ sc_refresh: "fictional-refresh" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still keeps field roles on their own pages", async () => {
    const response = await middleware(page({ sc_session: "a.b.c", sc_role: "DISTRICT_MANAGER" }, "/accounts"));
    expect(response.headers.get("location")).toContain("/no-access?page=hq");
  });
});
