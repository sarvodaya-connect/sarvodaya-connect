import { getCurrentViewer } from "./current-viewer";

const demoIdentity: Record<string, string> = {
  "hq-admin": "demo-hq-admin",
  "district-manager": "demo-dm-north",
  "programme-coordinator": "demo-programme-coordinator",
};

export function apiIdentityForViewer(viewer: Awaited<ReturnType<typeof getCurrentViewer>>) {
  return viewer.role === "SYSTEM_ADMIN" ? undefined : demoIdentity[viewer.id];
}

export function apiBaseUrl() {
  return (process.env.API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");
}

export async function loadApiJson<T>(path: string, viewer: Awaited<ReturnType<typeof getCurrentViewer>>): Promise<T> {
  const identity = apiIdentityForViewer(viewer);
  if (!identity) throw new Error("Forbidden");
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "X-Demo-User": identity },
  });
  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function proxyApiRequest(request: Request, path: string, method: "GET" | "POST" | "PATCH" = "GET") {
  const viewer = await getCurrentViewer();
  if (viewer.role === "SYSTEM_ADMIN" || !apiIdentityForViewer(viewer)) {
    return Response.json({ error: { code: "FORBIDDEN", message: "Your account cannot access this resource." } }, { status: 403 });
  }
  const base = apiBaseUrl();
  const incoming = new URL(request.url);
  const target = new URL(`${base}${path}`);
  if (method === "GET") target.search = incoming.search;
  const response = await fetch(target, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Demo-User": apiIdentityForViewer(viewer)!,
    },
    ...(method !== "GET" ? { body: await request.text() } : {}),
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
