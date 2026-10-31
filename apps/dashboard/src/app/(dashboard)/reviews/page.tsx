import { redirect } from "next/navigation";
import { AccessDeniedState } from "@/components/dashboard/data-states";
import { getCurrentViewer } from "@/lib/current-viewer";

export default async function ReviewsPage() {
  const viewer = await getCurrentViewer();
  if (viewer.role !== "HQ_ADMIN") return <AccessDeniedState role={viewer.roleLabel} />;
  redirect("/grade-changes");
}
