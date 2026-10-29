import { platformApi } from "@/lib/platform-api";
export async function POST(request: Request) {
  try {
    return Response.json(
      await platformApi("/identity/activation/check", {
        method: "POST",
        body: JSON.stringify(await request.json()),
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : "Activation unavailable" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
