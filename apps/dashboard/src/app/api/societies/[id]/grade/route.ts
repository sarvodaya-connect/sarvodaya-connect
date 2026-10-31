import { proxyApiRequest } from "@/lib/api-proxy";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: { message: "Invalid society ID" } }, { status: 400 });
  return proxyApiRequest(request, `/societies/${id}/grade`, "PATCH");
}
