import { notFound } from "next/navigation";

import { GradeRequestList } from "@/components/dashboard/society-record/record-lists";
import { getGradeRequests, getSocietyRecord } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { decideGradeRequest } from "../record-actions";

/** Grade tab. Only HQ gets the Approve and Reject actions; the API enforces it too. */
export default async function SocietyGradePage({ params, searchParams }: PageProps<"/societies/[id]/grade">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const [record, requests, { decided }] = await Promise.all([getSocietyRecord(id), getGradeRequests(id), searchParams]);
  return (
    <GradeRequestList
      decide={record.permissions.canChangeGrade ? decideGradeRequest.bind(null, id) : undefined}
      decided={typeof decided === "string" ? decided : undefined}
      requests={requests}
    />
  );
}
