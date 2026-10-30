import { notFound } from "next/navigation";

import { ExcoTable } from "@/components/dashboard/society-record/exco-table";
import { getSocietyRecord } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { revealMemberNic } from "../record-actions";

/** D05x: the society's Exco with masked NICs. */
export default async function SocietyExcoPage({ params }: PageProps<"/societies/[id]/exco">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const record = await getSocietyRecord(id);
  return <ExcoTable members={record.committee} revealNic={revealMemberNic.bind(null, id)} />;
}
