import { first } from "@/components/dashboard/national/format";
import { SarvoAiChat } from "@/components/dashboard/sarvoai/sarvoai-chat";
import { getCurrentViewer } from "@/lib/current-viewer";
import { isDemoMode } from "@/lib/platform-api";

/** V5 D40–D49f SarvoAI (HQ only; the API refuses every other role, and middleware sends them to the no-access page). */
export default async function SarvoAiPage({ searchParams }: PageProps<"/sarvoai">) {
  const viewer = await getCurrentViewer();
  const question = first((await searchParams).q)?.trim().slice(0, 500);
  return <SarvoAiChat demo={isDemoMode()} initialQuestion={question || undefined} viewerId={viewer.id} viewerInitials={viewer.initials} />;
}
