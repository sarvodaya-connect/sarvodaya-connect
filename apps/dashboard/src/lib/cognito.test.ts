import { describe, expect, it, vi } from "vitest";

import { authMode, cognitoConfig, cognitoRefresh, cognitoRevoke, cognitoSignIn, CognitoSignInError } from "./cognito";
import { SIGN_IN_FAILED, SIGN_IN_LOCKED, SIGN_IN_NOT_READY, SIGN_IN_UNAVAILABLE } from "./sign-in-messages";

const POOL = "ap-southeast-1_Fictional1";
const config = { region: "ap-southeast-1", userPoolId: POOL, clientId: "fictionalclient1" };
const reply = (status: number, body: object) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

describe("authMode", () => {
  it("uses the API's local passwords in development and Cognito in production", () => {
    expect(authMode({ NODE_ENV: "development" })).toBe("local");
    expect(authMode({ NODE_ENV: "production" })).toBe("cognito");
    expect(authMode({ NODE_ENV: "development", AUTH_PROVIDER: "Cognito" })).toBe("cognito");
  });

  it("never allows local passwords in production, or an unknown provider", () => {
    expect(() => authMode({ NODE_ENV: "production", AUTH_PROVIDER: "local" })).toThrow("cannot be used in production");
    expect(() => authMode({ NODE_ENV: "development", AUTH_PROVIDER: "saml" })).toThrow("AUTH_PROVIDER");
  });
});

describe("cognitoConfig", () => {
  it("fails closed when the user pool or app client is missing or wrong", () => {
    expect(() => cognitoConfig({ COGNITO_CLIENT_ID: "fictionalclient1" })).toThrow("COGNITO_USER_POOL_ID");
    expect(() => cognitoConfig({ COGNITO_USER_POOL_ID: "not-a-pool", COGNITO_CLIENT_ID: "fictionalclient1" })).toThrow("COGNITO_USER_POOL_ID");
    expect(() => cognitoConfig({ COGNITO_USER_POOL_ID: POOL })).toThrow("COGNITO_CLIENT_ID");
    expect(() => cognitoConfig({ COGNITO_USER_POOL_ID: POOL, COGNITO_CLIENT_ID: "fictionalclient1", COGNITO_REGION: "us-east-1" })).toThrow("COGNITO_REGION");
    expect(cognitoConfig({ COGNITO_USER_POOL_ID: POOL, COGNITO_CLIENT_ID: "fictionalclient1" })).toEqual(config);
  });
});

describe("Cognito calls (fetch is stubbed; nothing contacts AWS)", () => {
  it("signs in with USER_PASSWORD_AUTH on the public client, with no secret", async () => {
    const fetcher = reply(200, { AuthenticationResult: { AccessToken: "a.b.c", ExpiresIn: 3600, RefreshToken: "refresh" } });
    await expect(cognitoSignIn(config, "fictional.hq", "fictional-pass-1", fetcher)).resolves.toEqual({
      accessToken: "a.b.c",
      expiresIn: 3600,
      refreshToken: "refresh",
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://cognito-idp.ap-southeast-1.amazonaws.com/");
    expect(new Headers(init!.headers).get("X-Amz-Target")).toBe("AWSCognitoIdentityProviderService.InitiateAuth");
    const body = JSON.parse(String(init!.body));
    expect(body).toEqual({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: "fictionalclient1",
      AuthParameters: { USERNAME: "fictional.hq", PASSWORD: "fictional-pass-1" },
    });
    expect(body.AuthParameters).not.toHaveProperty("SECRET_HASH");
  });

  it("maps Cognito refusals to messages that reveal nothing about the account", async () => {
    const cases: [number, object, string][] = [
      [400, { __type: "NotAuthorizedException", message: "Incorrect username or password." }, SIGN_IN_FAILED],
      [400, { __type: "UserNotFoundException", message: "User does not exist." }, SIGN_IN_FAILED],
      [400, { __type: "NotAuthorizedException", message: "User is disabled." }, SIGN_IN_FAILED],
      [400, { __type: "NotAuthorizedException", message: "Password attempts exceeded" }, SIGN_IN_LOCKED],
      [400, { __type: "PasswordResetRequiredException" }, SIGN_IN_NOT_READY],
      [200, { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "s" }, SIGN_IN_NOT_READY],
      [400, { __type: "InvalidParameterException", message: "USER_PASSWORD_AUTH flow not enabled for this client" }, SIGN_IN_UNAVAILABLE],
      [500, {}, SIGN_IN_UNAVAILABLE],
    ];
    for (const [status, body, message] of cases) {
      const error = await cognitoSignIn(config, "fictional.hq", "wrong-pass-1", reply(status, body)).catch((e: unknown) => e);
      expect(error, JSON.stringify(body)).toBeInstanceOf(CognitoSignInError);
      expect((error as Error).message).toBe(message);
    }
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(cognitoSignIn(config, "fictional.hq", "x", offline)).rejects.toThrow(SIGN_IN_UNAVAILABLE);
  });

  it("refreshes with the refresh token and revokes it on sign-out", async () => {
    const refresh = reply(200, { AuthenticationResult: { AccessToken: "d.e.f", ExpiresIn: 3600 } });
    await expect(cognitoRefresh(config, "refresh", refresh)).resolves.toMatchObject({ accessToken: "d.e.f" });
    expect(JSON.parse(String(refresh.mock.calls[0]![1]!.body))).toEqual({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: "fictionalclient1",
      AuthParameters: { REFRESH_TOKEN: "refresh" },
    });
    const revoke = reply(200, {});
    await cognitoRevoke(config, "refresh", revoke);
    expect(new Headers(revoke.mock.calls[0]![1]!.headers).get("X-Amz-Target")).toBe("AWSCognitoIdentityProviderService.RevokeToken");
    expect(JSON.parse(String(revoke.mock.calls[0]![1]!.body))).toEqual({ ClientId: "fictionalclient1", Token: "refresh" });
  });
});
