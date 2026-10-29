import "server-only";
import { cookies } from "next/headers";
export const SESSION_COOKIE = "sc_session";
export const isDemoMode = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.PLATFORM_DEMO_MODE === "true";
export async function platformApi(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else if (isDemoMode()) headers.set("X-Demo-User", "demo-hq-admin");
  const base = process.env.API_BASE_URL ?? "http://localhost:3001/api/v1";
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "The service is unavailable. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof (body.error?.message ?? body.message) === "string"
        ? (body.error?.message ?? body.message)
        : "The request could not be completed. Check the fields and try again.",
    );
  }
  return response.json();
}
