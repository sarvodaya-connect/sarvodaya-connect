import { notFound } from "next/navigation";

import { GradeRequestList } from "@/components/dashboard/society-record/record-lists";
import { getGradeRequests } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

export default async function SocietyGradePage({ params }: PageProps<"/societies/[id]/grade">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  return <GradeRequestList requests={await getGradeRequests(id)} />;
}
