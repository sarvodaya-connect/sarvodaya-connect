import { notFound } from "next/navigation";

import type { SocietyHistoryCategory } from "@sarvodaya-connect/api-contracts";

import { HistoryList } from "@/components/dashboard/society-record/record-lists";
import { getHistory } from "@/lib/society-record-api";
import { isSocietyRecordId, SOCIETY_HISTORY_CATEGORIES } from "@/lib/society-record-format";

export default async function SocietyHistoryPage({ params, searchParams }: PageProps<"/societies/[id]/history">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const { category } = await searchParams;
  const selected = SOCIETY_HISTORY_CATEGORIES.find((value) => value === category) as SocietyHistoryCategory | undefined;
  const { data } = await getHistory(id, selected);
  return <HistoryList category={selected} events={data} societyId={id} />;
}
