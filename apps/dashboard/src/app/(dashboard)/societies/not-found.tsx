import { SocietyNoAccess } from "@/components/dashboard/district-access/no-access-views";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getHome } from "@/lib/home-api";

/**
 * V5 ST04, inside the user's own shell. The API answers "not found" for a
 * society outside the user's scope, so this page never says whether it exists.
 */
export default async function SocietyNotFound() {
  const viewer = await getDesktopViewer();
  if (viewer.role === "HQ_ADMIN" || viewer.role === "SYSTEM_ADMIN") return <SocietyNoAccess isHq />;
  const home = await getHome().catch(() => null);
  return <SocietyNoAccess assigned={home?.societies.total} isHq={false} recentlyEnded={home?.recentlyEnded ?? null} />;
}
