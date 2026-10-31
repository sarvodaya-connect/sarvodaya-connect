import { AccessDeniedState } from "@/components/dashboard/data-states";
import { GradeChangeReview } from "@/components/dashboard/grade-change-queue";
import { getCurrentViewer } from "@/lib/current-viewer";

export default async function GradeChangePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, viewer] = await Promise.all([params, getCurrentViewer()]);
  if (viewer.role !== "HQ_ADMIN") return <AccessDeniedState role={viewer.roleLabel} description="Only HQ can review grade-change requests." />;
  return <><h2 className="text-xl font-bold">Grade-change request</h2><GradeChangeReview id={id} /></>;
}
