import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityDetails } from "@/components/dashboard/activities/activity-details";
import { RecheckOnReturn } from "@/components/dashboard/district-access/recheck-on-return";
import { DevelopmentGoals } from "@/components/dashboard/activities/development-goals";
import { ActivityStatusPill } from "@/components/dashboard/society-record/work-plan-overview";
import { getT } from "@/i18n/server";
import { getActivity } from "@/lib/activities-api";
import { getSocietyRecord } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

export default async function WorkPlanActivityPage({ params }: PageProps<"/societies/[id]/work-plan/[activityId]">) {
  const { id, activityId } = await params;
  if (!isSocietyRecordId(id) || !isSocietyRecordId(activityId)) notFound();
  const [activity, record, t] = await Promise.all([getActivity(activityId), getSocietyRecord(id), getT()]);
  if (activity.society.id !== id) notFound();

  const page = (
    <>
      <Link className="mt-4 inline-block text-sm text-brand-forest underline underline-offset-2" href={`/societies/${id}/work-plan`}>
        {t("dg.backToPlan")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold text-ink">{activity.name}</h2>
        <ActivityStatusPill activity={activity} />
      </div>
      <ActivityDetails activity={activity} />
      <DevelopmentGoals activity={activity} t={t} />
    </>
  );
  return record.permissions.viewOnlyReason === "TEMPORARY_DISTRICT_ACCESS"
    ? <RecheckOnReturn token={randomUUID()}>{page}</RecheckOnReturn>
    : page;
}
