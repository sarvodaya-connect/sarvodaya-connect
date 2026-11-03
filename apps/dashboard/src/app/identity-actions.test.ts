import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SIGN_IN_FAILED, SIGN_IN_NOT_READY, SIGN_IN_UNAVAILABLE, SOCIETY_OFFICER_ON_DESKTOP } from "@/lib/sign-in-messages";

const jar = vi.hoisted(() => new Map<string, { value: string; options?: { maxAge?: number; httpOnly?: boolean } }>());
const api = vi.hoisted(() => ({ platformApi: vi.fn() }));

// vitest.setup.ts stubs these actions for component tests; this file tests the real ones.
vi.unmock("@/app/identity-actions");
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: object) => jar.set(name, { value, options }),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/platform-api", async () => {
  class PlatformApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  }
  return { PlatformApiError, platformApi: api.platformApi, isDemoMode: () => false, SESSION_COOKIE: "sc_session" };
});

const { login, signOut } = await import("./identity-actions");
const { PlatformApiError } = await import("@/lib/platform-api");

const form = (username: string, password: string) => {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
};
const cognitoReply = (body: object, status = 200) => new Response(JSON.stringify(body), { status });
const signedIn = { AuthenticationResult: { AccessToken: "a.b.c", ExpiresIn: 3600, RefreshToken: "fictional-refresh" } };

describe("dashboard sign-in with Cognito", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    jar.clear();
    api.platformApi.mockReset();
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

  it("signs in with Cognito, asks the API who this is, and keeps the tokens in httpOnly cookies", async () => {
    fetchMock.mockResolvedValueOnce(cognitoReply(signedIn));
    api.platformApi.mockResolvedValueOnce({ id: "u1", roles: ["DISTRICT_MANAGER"] });
    await expect(login({}, form(" Fictional.DM ", "fictional-pass-1"))).rejects.toMatchObject({ path: "/dashboard" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).AuthParameters.USERNAME).toBe("fictional.dm");
    expect(api.platformApi).toHaveBeenCalledWith("/identity/me", { headers: { Authorization: "Bearer a.b.c" } });
    expect(api.platformApi).not.toHaveBeenCalledWith("/identity/login", expect.anything());
    expect(jar.get("sc_session")).toMatchObject({ value: "a.b.c", options: { httpOnly: true, maxAge: 3540 } });
    expect(jar.get("sc_refresh")).toMatchObject({ value: "fictional-refresh", options: { httpOnly: true, maxAge: 8 * 3600 } });
    expect(jar.get("sc_role")?.value).toBe("DISTRICT_MANAGER");
  });

  it("a wrong password shows the plain refusal and keeps the username", async () => {
    fetchMock.mockResolvedValueOnce(cognitoReply({ __type: "NotAuthorizedException", message: "Incorrect username or password." }, 400));
    await expect(login({}, form("fictional.dm", "wrong-pass-1"))).resolves.toEqual({ error: SIGN_IN_FAILED, username: "fictional.dm" });
    expect(jar.size).toBe(0);
  });

  it("a Cognito user the API does not know (unlinked or disabled) is signed out again", async () => {
    fetchMock.mockResolvedValueOnce(cognitoReply(signedIn)).mockResolvedValueOnce(cognitoReply({}));
    api.platformApi.mockRejectedValueOnce(new PlatformApiError("Sign in to continue", 401));
    await expect(login({}, form("fictional.gone", "fictional-pass-1"))).resolves.toEqual({ error: SIGN_IN_NOT_READY, username: "fictional.gone" });
    expect(new Headers(fetchMock.mock.calls[1]![1]!.headers).get("X-Amz-Target")).toContain("RevokeToken");
    expect(jar.size).toBe(0);
  });

  it("a Society Officer is sent to the phone app and the sign-in is revoked", async () => {
    fetchMock.mockResolvedValueOnce(cognitoReply(signedIn)).mockResolvedValueOnce(cognitoReply({}));
    api.platformApi.mockResolvedValueOnce({ id: "u2", roles: ["SOCIETY_OFFICER"] });
    await expect(login({}, form("fictional.officer", "fictional-pass-1"))).resolves.toMatchObject({ error: SOCIETY_OFFICER_ON_DESKTOP });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(jar.size).toBe(0);
  });

  it("missing configuration fails closed with a general message and contacts nobody", async () => {
    vi.stubEnv("COGNITO_CLIENT_ID", "");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(login({}, form("fictional.dm", "fictional-pass-1"))).resolves.toEqual({ error: SIGN_IN_UNAVAILABLE, username: "fictional.dm" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(String(quiet.mock.calls[0]?.[0])).not.toContain("fictional-pass-1");
    quiet.mockRestore();
  });

  it("empty fields never reach Cognito", async () => {
    await expect(login({}, form("", ""))).resolves.toMatchObject({ error: SIGN_IN_FAILED });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sign-out revokes the refresh token and removes every sign-in cookie", async () => {
    jar.set("sc_session", { value: "a.b.c" }).set("sc_refresh", { value: "fictional-refresh" }).set("sc_role", { value: "HQ_ADMIN" });
    fetchMock.mockResolvedValueOnce(cognitoReply({}));
    await expect(signOut()).rejects.toMatchObject({ path: "/" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ ClientId: "fictionalclient1", Token: "fictional-refresh" });
    expect(jar.size).toBe(0);
  });
});

describe("dashboard sign-in in local development", () => {
  beforeEach(() => {
    jar.clear();
    api.platformApi.mockReset();
    vi.stubEnv("AUTH_PROVIDER", "local");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the API's local sign-in and stores no refresh token", async () => {
    api.platformApi.mockResolvedValueOnce({ token: "localtoken", user: { roles: ["HQ_ADMIN"] } });
    await expect(login({}, form("dev.hq", "dev-pass-123"))).rejects.toMatchObject({ path: "/dashboard" });
    expect(api.platformApi).toHaveBeenCalledWith("/identity/login", expect.objectContaining({ method: "POST" }));
    expect(jar.get("sc_session")?.value).toBe("localtoken");
    expect(jar.has("sc_refresh")).toBe(false);
  });
});
