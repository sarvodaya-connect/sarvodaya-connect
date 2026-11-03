/**
 * Amazon Cognito sign-in for the dashboard (AUTH_PROVIDER=cognito). Runs on
 * the server only (server actions and middleware): the browser never talks to
 * Cognito and never sees a token, which stay in httpOnly cookies.
 *
 * The app client is public (no client secret). Only the user pool and app
 * client ids are configured here; they are not secrets. Account administration
 * is the API's job, with its IAM role, never the dashboard's.
 */
import { SIGN_IN_FAILED, SIGN_IN_LOCKED, SIGN_IN_NOT_READY, SIGN_IN_UNAVAILABLE } from "./sign-in-messages";

export type AuthMode = "local" | "cognito";

type Env = Partial<Record<"NODE_ENV" | "AUTH_PROVIDER" | "COGNITO_USER_POOL_ID" | "COGNITO_CLIENT_ID" | "COGNITO_REGION", string>>;

/** Each variable is read by name, so Next.js also supplies it to middleware (Edge runtime). */
const serverEnv = (): Env => ({
  NODE_ENV: process.env.NODE_ENV,
  AUTH_PROVIDER: process.env.AUTH_PROVIDER,
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
  COGNITO_REGION: process.env.COGNITO_REGION,
});

/** AUTH_PROVIDER: "cognito" by default in production, "local" (the API's own passwords) in development. */
export function authMode(env: Env = serverEnv()): AuthMode {
  const configured = env.AUTH_PROVIDER?.trim().toLowerCase();
  const mode = configured || (env.NODE_ENV === "production" ? "cognito" : "local");
  if (mode !== "local" && mode !== "cognito") throw new Error('AUTH_PROVIDER must be "local" or "cognito"');
  if (mode === "local" && env.NODE_ENV === "production") throw new Error("AUTH_PROVIDER=local cannot be used in production");
  return mode;
}

export type CognitoConfig = { region: string; userPoolId: string; clientId: string };

const USER_POOL_ID = /^([a-z]{2}(?:-[a-z]+)+-\d)_[A-Za-z0-9]+$/;

/** The user pool and public app client. Throws (so sign-in fails closed) when either is missing or wrong. */
export function cognitoConfig(env: Env = serverEnv()): CognitoConfig {
  const userPoolId = env.COGNITO_USER_POOL_ID?.trim() ?? "";
  const clientId = env.COGNITO_CLIENT_ID?.trim() ?? "";
  const region = USER_POOL_ID.exec(userPoolId)?.[1];
  if (!region) throw new Error("COGNITO_USER_POOL_ID is missing or not <region>_<id>");
  if (!/^[a-z0-9]{1,128}$/i.test(clientId)) throw new Error("COGNITO_CLIENT_ID is missing");
  const configured = env.COGNITO_REGION?.trim();
  if (configured && configured !== region) throw new Error("COGNITO_REGION does not match COGNITO_USER_POOL_ID");
  return { region, userPoolId, clientId };
}

export type CognitoTokens = { accessToken: string; expiresIn: number; refreshToken?: string };

/** A sign-in failure with a message that is safe to show. */
export class CognitoSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CognitoSignInError";
  }
}

type Fetch = typeof fetch;

async function cognitoCall(config: CognitoConfig, target: string, body: object, fetcher: Fetch) {
  let response: Response;
  try {
    response = await fetcher(`https://cognito-idp.${config.region}.amazonaws.com/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new CognitoSignInError(SIGN_IN_UNAVAILABLE);
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.ok) return data;
  // Cognito's error type, e.g. "NotAuthorizedException" (sometimes prefixed with a namespace).
  const type = String(data.__type ?? "").split("#").pop();
  const message = String(data.message ?? "");
  if (type === "NotAuthorizedException" && /attempts exceeded/i.test(message)) throw new CognitoSignInError(SIGN_IN_LOCKED);
  if (type === "NotAuthorizedException" || type === "UserNotFoundException") throw new CognitoSignInError(SIGN_IN_FAILED);
  if (type === "PasswordResetRequiredException" || type === "UserNotConfirmedException") throw new CognitoSignInError(SIGN_IN_NOT_READY);
  throw new CognitoSignInError(SIGN_IN_UNAVAILABLE);
}

function tokensFrom(data: Record<string, unknown>): CognitoTokens {
  const result = data.AuthenticationResult as { AccessToken?: string; ExpiresIn?: number; RefreshToken?: string } | undefined;
  // A challenge (for example NEW_PASSWORD_REQUIRED) means the account was not finished by HQ.
  if (!result?.AccessToken) throw new CognitoSignInError(data.ChallengeName ? SIGN_IN_NOT_READY : SIGN_IN_UNAVAILABLE);
  return { accessToken: result.AccessToken, expiresIn: result.ExpiresIn ?? 3600, refreshToken: result.RefreshToken };
}

/** Username and password sign-in (the app client must allow USER_PASSWORD_AUTH). */
export async function cognitoSignIn(config: CognitoConfig, username: string, password: string, fetcher: Fetch = fetch) {
  return tokensFrom(
    await cognitoCall(
      config,
      "InitiateAuth",
      { AuthFlow: "USER_PASSWORD_AUTH", ClientId: config.clientId, AuthParameters: { USERNAME: username, PASSWORD: password } },
      fetcher,
    ),
  );
}

/** A new access token from the refresh token. Cognito refuses it after sign-out, a password reset or a disable. */
export async function cognitoRefresh(config: CognitoConfig, refreshToken: string, fetcher: Fetch = fetch) {
  return tokensFrom(
    await cognitoCall(config, "InitiateAuth", { AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: config.clientId, AuthParameters: { REFRESH_TOKEN: refreshToken } }, fetcher),
  );
}

/** Ends the sign-in: Cognito revokes the refresh token and the access tokens issued from it. */
export async function cognitoRevoke(config: CognitoConfig, refreshToken: string, fetcher: Fetch = fetch) {
  await cognitoCall(config, "RevokeToken", { ClientId: config.clientId, Token: refreshToken }, fetcher);
}
