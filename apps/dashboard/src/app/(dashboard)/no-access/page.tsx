import { redirect } from "next/navigation";

import { RolePageNoAccess } from "@/components/dashboard/district-access/no-access-views";
import { getDesktopViewer } from "@/lib/current-viewer";

/** V5 M69d on the desktop: where SPCs, DDMs and DMs land when they follow a link to an HQ page. */
export default async function NoAccessPage() {
  const viewer = await getDesktopViewer();
  if (viewer.role === "HQ_ADMIN") redirect("/dashboard");
  return <RolePageNoAccess name={viewer.displayName} roleLabel={viewer.roleLabel} scope={viewer.scopeLabel} />;
}
