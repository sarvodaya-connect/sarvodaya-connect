import { notFound } from "next/navigation";

import { DocumentsList } from "@/components/dashboard/society-record/record-lists";
import { getSocietyDocuments } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

export default async function SocietyDocumentsPage({ params }: PageProps<"/societies/[id]/documents">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const { data } = await getSocietyDocuments(id);
  return <DocumentsList documents={data} societyId={id} />;
}
