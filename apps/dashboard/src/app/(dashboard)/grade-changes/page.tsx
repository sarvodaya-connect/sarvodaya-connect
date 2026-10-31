import { PageHeading } from "@/components/dashboard/page-heading";
import { AccessDeniedState } from "@/components/dashboard/data-states";
import { GradeChangeQueue } from "@/components/dashboard/grade-change-queue";
import { getCurrentViewer } from "@/lib/current-viewer";

export default async function GradeChangesPage() {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN") return <AccessDeniedState role={viewer.roleLabel} description="Only HQ can view and decide grade-change requests." />;
  return <><PageHeading title="Grade-change queue" description="Review and decide society classification requests across all districts." /><GradeChangeQueue /></>;
}
