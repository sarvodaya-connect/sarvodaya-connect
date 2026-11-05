import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";

import { isRetryableStatus, READ_SLOTS_PER_RENDER, readWithRetry, type ReadResult, ReadSlots, ReadUnreachableError } from "./platform-read";
import { SESSION_COOKIE } from "./session-cookies";
export { SESSION_COOKIE };

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
  // An explicit Authorization header (sign-in checking a new token) wins over the cookie.
  if (headers.has("Authorization")) {
    /* keep it */
  } else if (token) headers.set("Authorization", `Bearer ${token}`);
  // Demonstration mode only: pages for another role name their demo user.
  else if (isDemoMode() && !headers.has("X-Demo-User")) headers.set("X-Demo-User", "demo-hq-admin");
  const base = process.env.API_BASE_URL ?? "http://localhost:3001/api/v1";
  const url = `${base.replace(/\/$/, "")}${path}`;
  const request: RequestInit = { ...init, headers, cache: "no-store" };
  if ((init.method ?? "GET").toUpperCase() === "GET") return parseResult(await sharedRead(path, url, request, headers));

  // Writes get one try: repeating one could apply it twice.
  let response: Response;
  try {
    response = await fetch(url, request);
  } catch {
    throw unreachable();
  }
  return parseResult({ status: response.status, ok: response.ok, text: await response.text() });
}

/**
 * True when trying again later may work: the API could not be reached, was
 * overloaded or failed. A refusal (401, 403, 404, 400) is not.
 */
export function isTransientPlatformError(error: unknown) {
  return error instanceof PlatformApiError && (error.status === 0 || error.status >= 500 || isRetryableStatus(error.status));
}

const unreachable = () =>
  new PlatformApiError("The service is unavailable. Check your connection and try again.", 0);

/**
 * What one page render shares. React gives each render its own, so nothing here
 * outlives the request or reaches another user. Outside a render (server actions
 * and route handlers) each call gets a new one, so reads there run independently.
 */
const renderScope = cache(() => ({
  reads: new Map<string, Promise<ReadResult>>(),
  slots: new ReadSlots(READ_SLOTS_PER_RENDER),
}));

/** Layouts and the page asking for the same thing in one render share one request. */
function sharedRead(path: string, url: string, init: RequestInit, headers: Headers): Promise<ReadResult> {
  const scope = renderScope();
  const read = () =>
    readWithRetry(url, init, {
      slots: scope.slots,
      // The route only: query strings can hold search terms. Never headers.
      onRetry: (attempt, status) =>
        console.warn(`Retrying API read ${path.split("?")[0]}: attempt ${attempt} ended in ${status || "no response"}`),
    }).catch((error: unknown) => {
      if (error instanceof ReadUnreachableError) throw unreachable();
      throw error;
    });
  if (init.signal) return read();
  const key = `${headers.get("Authorization") ?? ""}|${headers.get("X-Demo-User") ?? ""}|${url}`;
  const known = scope.reads.get(key);
  if (known) return known;
  const pending = read();
  scope.reads.set(key, pending);
  return pending;
}

/** Each caller gets its own copy of the answer, so one cannot change another's. */
function parseResult({ ok, status, text }: ReadResult) {
  if (ok) return JSON.parse(text);
  let body: { error?: { message?: unknown; details?: unknown }; message?: unknown } = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* A gateway error may not be JSON. */
  }
  const message = body.error?.message ?? body.message;
  const details = Array.isArray(body.error?.details)
    ? body.error.details
        .map((detail: { field?: string; messages?: string[] }) => {
          const explanation = detail.messages?.join(", ");
          return explanation ? `${detail.field ?? "Field"}: ${explanation}` : null;
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
    status,
  );
}
