"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { platformApi, SESSION_COOKIE } from "@/lib/platform-api";
import { getCurrentViewer } from "@/lib/current-viewer";
import { NOT_HQ_ON_DESKTOP, SOCIETY_OFFICER_ON_DESKTOP } from "@/lib/sign-in-messages";
export type FormResult = {
  error?: string;
  success?: string;
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
    if (result.user?.roles.includes("SOCIETY_OFFICER"))
      return { error: SOCIETY_OFFICER_ON_DESKTOP };
    // SPC, DDM and DM desktop dashboards open in PR 6 of the V5 plan.
    if (!result.user?.roles.includes("HQ_ADMIN"))
      return { error: NOT_HQ_ON_DESKTOP };
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
