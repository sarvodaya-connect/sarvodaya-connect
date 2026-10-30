import { NextResponse } from "next/server";

import { platformApi } from "@/lib/platform-api";

/**
 * Opens or downloads a society document. The API checks the signed-in user's
 * access and returns a short-lived link; the file itself stays private.
 */
export async function GET(_request: Request, { params }: RouteContext<"/societies/[id]/documents/[documentId]/download">) {
  const { documentId } = await params;
  try {
    const link = await platformApi(`/documents/${documentId}/download`);
    return NextResponse.redirect(link.url, 303);
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "The document could not be opened.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
