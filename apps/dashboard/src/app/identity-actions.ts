"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, cognitoConfig, cognitoRevoke, cognitoSignIn, CognitoSignInError } from "@/lib/cognito";
import { PlatformApiError, platformApi } from "@/lib/platform-api";
import { DESKTOP_ROLES, getCurrentViewer, ROLE_COOKIE } from "@/lib/current-viewer";
import { REFRESH_COOKIE, SESSION_COOKIE, sessionCookie, SIGN_IN_SECONDS } from "@/lib/session-cookies";
import {
  NOT_HQ_ON_DESKTOP,
  SIGN_IN_FAILED,
  SIGN_IN_NOT_READY,
  SIGN_IN_UNAVAILABLE,
  SOCIETY_OFFICER_ON_DESKTOP,
} from "@/lib/sign-in-messages";
export type FormResult = {
  error?: string;
  success?: string;
  /** D01e keeps the username after a failed sign-in. */
  username?: string;
};

/** The roles of the account behind a new token, or null when the API refuses it (unlinked or disabled). */
async function rolesFor(token: string): Promise<string[] | null> {
  try {
    const me: { roles?: string[] } = await platformApi("/identity/me", { headers: { Authorization: `Bearer ${token}` } });
    return me.roles ?? [];
  } catch (e) {
    if (e instanceof PlatformApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
}

/** Ends a Cognito sign-in; best effort, the cookies are removed either way. */
async function revokeCognito(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await cognitoRevoke(cognitoConfig(), refreshToken).catch(() => undefined);
}

export async function login(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const username = String(form.get("username") ?? "").trim().slice(0, 100);
  const password = String(form.get("password") ?? "");
  if (!username || !password) return { error: SIGN_IN_FAILED, username };
  let role: (typeof DESKTOP_ROLES)[number] | undefined;
  try {
    let token: string;
    let refreshToken: string | undefined;
    let tokenSeconds = SIGN_IN_SECONDS;
    let roles: string[] | null;
    if (authMode() === "cognito") {
      // Cognito checks the password; the API then decides who this is from its own records.
      const tokens = await cognitoSignIn(cognitoConfig(), username.toLowerCase(), password);
      token = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      tokenSeconds = Math.max(60, Math.min(tokens.expiresIn - 60, SIGN_IN_SECONDS));
      roles = await rolesFor(token);
      if (!roles) {
        await revokeCognito(refreshToken);
        return { error: SIGN_IN_NOT_READY, username };
      }
    } else {
      const result: { token: string; user?: { roles: string[] } } = await platformApi("/identity/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      token = result.token;
      roles = result.user?.roles ?? [];
    }
    // V5: HQ, DMs, DDMs and SPCs use the desktop; Society Officers use the phone app.
    role = DESKTOP_ROLES.find((candidate) => roles.includes(candidate));
    if (!role) {
      // Not a desktop role: end the sign-in that was just opened.
      if (refreshToken) await revokeCognito(refreshToken);
      else
        await platformApi("/identity/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      return {
        error: roles.includes("SOCIETY_OFFICER") ? SOCIETY_OFFICER_ON_DESKTOP : NOT_HQ_ON_DESKTOP,
        username,
      };
    }
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookie(tokenSeconds));
    if (refreshToken) jar.set(REFRESH_COOKIE, refreshToken, sessionCookie(SIGN_IN_SECONDS));
    jar.set(ROLE_COOKIE, role, sessionCookie(SIGN_IN_SECONDS));
  } catch (e) {
    if (e instanceof CognitoSignInError || e instanceof PlatformApiError) return { error: e.message, username };
    // Missing or wrong sign-in configuration: say so in the server log, never to the person.
    console.error(`Sign-in is not configured: ${e instanceof Error ? e.message : "unknown error"}`);
    return { error: SIGN_IN_UNAVAILABLE, username };
  }
  redirect("/welcome");
}

/** Removes every sign-in cookie. */
async function clearSignIn() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(ROLE_COOKIE);
}

export async function signOut() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  try {
    if (refreshToken) await revokeCognito(refreshToken);
    else await platformApi("/identity/logout", { method: "POST" });
  } catch {
    /* Remove browser credentials even if the API is unavailable. */
  }
  await clearSignIn();
  redirect("/");
}
export async function createAccount(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN") return { error: "HQ access required" };
  const password = String(form.get("password") ?? "");
  if (password !== form.get("confirmPassword"))
    return { error: "The passwords do not match." };
  const input = {
    displayName: form.get("displayName"),
    username: String(form.get("username") ?? "").trim().toLowerCase(),
    phone: form.get("phone"),
    email: form.get("email") || undefined,
    role: form.get("role"),
    districtId: form.get("districtId") || undefined,
    societyIds: form.getAll("societyIds").filter(Boolean),
    password,
  };
  try {
    await platformApi("/identity/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/accounts");
    return {
      success: `Account created for ${input.username}. Give the username and password to the person yourself, in person or by phone, not by email or chat.`,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not create account",
    };
  }
}
export async function setAccountPassword(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN") return { error: "HQ access required" };
  const id = String(form.get("id"));
  if (!/^[a-f0-9-]{36}$/i.test(id)) return { error: "Invalid account" };
  const password = String(form.get("password") ?? "");
  if (password !== form.get("confirmPassword"))
    return { error: "The passwords do not match." };
  try {
    await platformApi(`/identity/accounts/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not change password" };
  }
  revalidatePath("/accounts");
  if (id === viewer.id) {
    await clearSignIn();
    redirect("/");
  }
  return {
    success:
      "Password set. The old password no longer works and the person has been signed out everywhere. Give the new password to them yourself, in person or by phone, not by email or chat.",
  };
}
/** D16: HQ changes a person's role or scope. The API signs them out and ends any temporary district view. */
export async function updateAccount(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN") return { error: "HQ access required" };
  const id = String(form.get("id"));
  if (!/^[a-f0-9-]{36}$/i.test(id)) return { error: "Invalid account" };
  const input = {
    displayName: form.get("displayName"),
    username: form.get("username"),
    phone: form.get("phone"),
    email: form.get("email") || undefined,
    role: form.get("role"),
    districtId: form.get("districtId") || undefined,
    societyIds: form.getAll("societyIds").filter(Boolean),
  };
  try {
    await platformApi(`/identity/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not change the role" };
  }
  revalidatePath("/accounts");
  return { success: "Role and scope changed. The person has been signed out and signs in again to see the change." };
}
/** D16: HQ disables an account. The API signs the person out straight away. */
export async function disableAccount(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN") return { error: "HQ access required" };
  const id = String(form.get("id"));
  if (!/^[a-f0-9-]{36}$/i.test(id)) return { error: "Invalid account" };
  try {
    await platformApi(`/identity/accounts/${id}/disable`, { method: "POST" });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not disable the account" };
  }
  revalidatePath("/accounts");
  return { success: "Account disabled. The person has been signed out and can no longer sign in." };
}
