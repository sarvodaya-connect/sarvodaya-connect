"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { platformApi, SESSION_COOKIE } from "@/lib/platform-api";
import { getCurrentViewer, SPC_DESKTOP_HOME } from "@/lib/current-viewer";
import { NOT_HQ_ON_DESKTOP, SOCIETY_OFFICER_ON_DESKTOP } from "@/lib/sign-in-messages";
export type FormResult = {
  error?: string;
  success?: string;
  /** D01e keeps the username after a failed sign-in. */
  username?: string;
};

export async function login(
  _previous: FormResult,
  form: FormData,
): Promise<FormResult> {
  const username = String(form.get("username") ?? "").slice(0, 100);
  let result;
  try {
    result = await platformApi("/identity/login", {
      method: "POST",
      body: JSON.stringify({ username, password: form.get("password") }),
    });
    const isHq = result.user?.roles.includes("HQ_ADMIN");
    // V5 SP06–SP08: SPCs approve activities on the desktop. Their other pages open in PR 6.
    const isSpc = result.user?.roles.includes("PROGRAMME_COORDINATOR");
    if (!isHq && !isSpc) {
      // Not for this dashboard yet: end the session the API just opened.
      await platformApi("/identity/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${result.token}` },
      }).catch(() => undefined);
      // SPC, DDM and DM desktop dashboards open in PR 6 of the V5 plan.
      return {
        error: result.user?.roles.includes("SOCIETY_OFFICER") ? SOCIETY_OFFICER_ON_DESKTOP : NOT_HQ_ON_DESKTOP,
        username,
      };
    }
    (await cookies()).set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 3600,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not sign in", username };
  }
  redirect(result.user?.roles.includes("HQ_ADMIN") ? "/dashboard" : SPC_DESKTOP_HOME);
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
      success: `Account created for ${input.username}. Give the username and password to the person yourself.`,
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
  return { success: "Password set. The old password no longer works. Give the new one to the person yourself." };
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
