import { notFound } from "next/navigation";

import { WorkPlanOverview } from "@/components/dashboard/society-record/work-plan-overview";
import { getWorkPlan } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

/** D05w: the society's work plan. */
export default async function SocietyWorkPlanPage({ params }: PageProps<"/societies/[id]/work-plan">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  return <WorkPlanOverview plan={await getWorkPlan(id)} />;
}
