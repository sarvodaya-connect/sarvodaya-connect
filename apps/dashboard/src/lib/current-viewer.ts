import { cookies } from "next/headers";

import { DEMO_VIEWER_COOKIE, getViewer, type DemoViewer } from "./access";

/**
 * The demonstration user viewing the dashboard, chosen with "Viewing as" in
 * the header. Replaced by the signed-in Amazon Cognito user later.
 */
export async function getCurrentViewer(): Promise<DemoViewer> {
  const cookieStore = await cookies();
  return getViewer(cookieStore.get(DEMO_VIEWER_COOKIE)?.value);
}
