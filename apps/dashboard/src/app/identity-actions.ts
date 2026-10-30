"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { platformApi, SESSION_COOKIE } from "@/lib/platform-api";
import { getCurrentViewer } from "@/lib/current-viewer";
export type FormResult = {
  error?: string;
  success?: string;
  credential?: string;
  username?: string;
  expiresAt?: string;
  activationUrl?: string;
  method?: string;
};
export async function login(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  let result;
  try {
    result = await platformApi("/identity/login", {
      method: "POST",
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });
    if (!result.user?.roles.includes("HQ_ADMIN"))
      return { error: "This dashboard is for HQ. Please use the mobile app." };
    (await cookies()).set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 3600,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not sign in" };
  }
  redirect("/dashboard");
}
export async function signOut() {
  try {
    await platformApi("/identity/logout", { method: "POST" });
  } catch {
    /* Remove browser credentials even if the API is unavailable. */
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
export async function activate(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  if (form.get("password") !== form.get("confirm"))
    return { error: "The passwords do not match." };
  try {
    await platformApi("/identity/activation/complete", {
      method: "POST",
      body: JSON.stringify({
        credential: form.get("credential"),
        username: form.get("username") || undefined,
        password: form.get("password"),
      }),
    });
    return {
      success:
        "Your account is ready. Sign in with your username and new password.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Activation failed" };
  }
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
    societyIds: form.getAll("societyIds"),
    password,
  };
  try {
    await platformApi("/identity/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/accounts");
    return {
      success: "Account created. Hand the username and password to the staff member securely.",
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
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/");
  }
  return { success: "Password replaced. Give the new password to the staff member securely." };
}
export async function reissueAccount(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN") return { error: "HQ access required" };
  const id = String(form.get("id"));
  if (!/^[a-f0-9-]{36}$/i.test(id)) return { error: "Invalid account" };
  try {
    const result = await platformApi(`/identity/accounts/${id}/invitation`, {
      method: "POST",
      body: JSON.stringify({ method: form.get("method") }),
    });
    revalidatePath("/accounts");
    return {
      activationUrl: result.activationUrl,
      credential: result.credential,
      username: result.account.username,
      expiresAt: result.expiresAt,
      method: result.method,
      success:
        "New activation details issued. Previous invitations and sessions are invalid.",
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not reissue invitation",
    };
  }
}
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
    societyIds: form.getAll("societyIds"),
  };
  try {
    await platformApi(`/identity/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    revalidatePath("/accounts");
    return { success: "Assignments updated. The person must sign in again." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Unable to update account",
    };
  }
}
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
    revalidatePath("/accounts");
    return {
      success: "Account disabled. Existing sessions have been revoked.",
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Unable to disable account",
    };
  }
}
