import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityForm } from "@/components/dashboard/activities/activity-form";
import { NoAccessState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { getSocietyRecord, getWorkPlan } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { createActivity } from "../../record-actions";

/** V5 D05w "Add activity" (M09a–M09c on the desktop). */
export default async function NewActivityPage({ params }: PageProps<"/societies/[id]/work-plan/new">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const [record, plan] = await Promise.all([getSocietyRecord(id), getWorkPlan(id)]);
  if (!plan.permissions?.canAddActivities) {
    return (
      <section className="mt-4 rounded-card border border-line bg-surface">
        <NoAccessState
          action={<Link className={secondaryButtonClass} href={`/societies/${id}/work-plan`}>Back to the work plan</Link>}
          description="You can view this work plan but cannot add activities to it."
          title="You Can’t Add Activities Here"
        />
      </section>
    );
  }
  const thisYear = new Date().getFullYear();
  const years = [...new Set([plan.year, thisYear, thisYear + 1])].sort((a, b) => b - a);
  const spc = record.staff.find((member) => member.role === "PROGRAMME_COORDINATOR");
  return (
    <>
      <h2 className="mt-4 text-[17px] font-bold text-ink">New Activity</h2>
      <p className="text-[12px] text-ink-soft">{record.nameEn} · work plan</p>
      <ActivityForm action={createActivity.bind(null, id)} societyId={id} spcName={spc?.displayName} years={years} />
    </>
  );
}
