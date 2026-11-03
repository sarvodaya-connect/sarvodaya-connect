/**
 * Sign-in cookies. httpOnly, so page scripts never read the tokens.
 * SESSION_COOKIE holds the API token: a local session token, or a Cognito
 * access token that expires a minute before the token itself does.
 * REFRESH_COOKIE (Cognito only) lets middleware.ts get a new access token.
 */
export const SESSION_COOKIE = "sc_session";
export const REFRESH_COOKIE = "sc_refresh";
/** Longest sign-in, as with local sessions: 8 hours. Match the app client's refresh token expiry. */
export const SIGN_IN_SECONDS = 8 * 3600;

export const sessionCookie = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});
