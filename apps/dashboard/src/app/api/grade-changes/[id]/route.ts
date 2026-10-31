import { proxyApiRequest } from "@/lib/api-proxy";

export async function GET(request: Request, context: RouteContext<"/api/grade-changes/[id]">) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: { message: "Invalid request" } }, { status: 400 });
  return proxyApiRequest(request, `/grade-changes/${id}`);
}

export async function POST(request: Request, context: RouteContext<"/api/grade-changes/[id]">) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: { message: "Invalid request" } }, { status: 400 });
  return proxyApiRequest(request, `/grade-changes/${id}/decision`, "POST");
}
