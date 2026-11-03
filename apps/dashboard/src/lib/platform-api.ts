import "server-only";
import { cookies } from "next/headers";
export const SESSION_COOKIE = "sc_session";

/** A refused or failed API request; `status` is the HTTP status (0 when the API could not be reached). */
export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}
export const isDemoMode = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.PLATFORM_DEMO_MODE === "true";
export async function platformApi(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Demonstration mode only: pages for another role name their demo user.
  else if (isDemoMode() && !headers.has("X-Demo-User")) headers.set("X-Demo-User", "demo-hq-admin");
  const base = process.env.API_BASE_URL ?? "http://localhost:3001/api/v1";
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new PlatformApiError(
      "The service is unavailable. Check your connection and try again.",
      0,
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body.error?.message ?? body.message;
    const details = Array.isArray(body.error?.details)
      ? body.error.details
          .map((detail: { field?: string; messages?: string[] }) => {
            const explanation = detail.messages?.join(", ");
            return explanation
              ? `${detail.field ?? "Field"}: ${explanation}`
              : null;
          })
          .filter(Boolean)
          .join("; ")
      : "";
    throw new PlatformApiError(
      typeof message === "string"
        ? message === "Request validation failed" && details
          ? `${message}: ${details}`
          : message
        : "The request could not be completed. Check the fields and try again.",
      response.status,
    );
  }
  return response.json();
}
