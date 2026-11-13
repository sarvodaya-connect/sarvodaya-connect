import { notFound } from "next/navigation";

import { SocietyEconomy } from "@/components/dashboard/economy/society-economy";
import { first } from "@/components/dashboard/national/format";
import { getT } from "@/i18n/server";
import { getEconomicProfile, getSocietyProductionRecords } from "@/lib/economy-api";
import { safeReturnPath } from "@/lib/economy-format";
import { isSocietyRecordId } from "@/lib/society-record-format";

/**
 * Issue #147: the society record's Village Economic Profile (read-only). The
 * API answers 404 for a society outside the viewer's scope, which shows the
 * usual not-found page. `from` returns to the overview with its filters.
 */
export default async function SocietyEconomyPage({ params, searchParams }: PageProps<"/societies/[id]/economy">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const search = await searchParams;
  const page = Math.min(Math.max(Number(first(search.page)) || 1, 1), 10_000);
  const [profile, records, t] = await Promise.all([getEconomicProfile(id), getSocietyProductionRecords(id, page), getT()]);
  return <SocietyEconomy profile={profile} records={records} returnTo={safeReturnPath(search.from)} t={t} />;
}
