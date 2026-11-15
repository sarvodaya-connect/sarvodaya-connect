import { notFound } from "next/navigation";

import { RecordHistory } from "@/components/dashboard/economy/society-economy";
import { getT } from "@/i18n/server";
import { getEconomicProfile, getRecordHistory } from "@/lib/economy-api";
import { productLabel, safeReturnPath } from "@/lib/economy-format";
import { isSocietyRecordId } from "@/lib/society-record-format";

/** Issue #147: one production record's saved versions. */
export default async function ProductionRecordHistoryPage({ params, searchParams }: PageProps<"/societies/[id]/economy/records/[recordId]">) {
  const { id, recordId } = await params;
  if (!isSocietyRecordId(id) || !isSocietyRecordId(recordId)) notFound();
  const [profile, history, t, search] = await Promise.all([getEconomicProfile(id), getRecordHistory(recordId), getT(), searchParams]);
  // Only a record of this society is shown under this society's header.
  const owner = profile.businesses.flatMap((business) => business.outputs.map((output) => ({ business, output }))).find(
    ({ output }) => output.id === history.record.outputId,
  );
  if (!owner) notFound();
  const returnTo = safeReturnPath(search.from);
  return (
    <RecordHistory
      backHref={`/societies/${id}/economy${returnTo ? `?from=${encodeURIComponent(returnTo)}` : ""}`}
      outputLabel={`${owner.business.name} · ${productLabel(owner.output.product, t, owner.output.otherDescription)}`}
      record={history.record}
      revisions={history.revisions}
      t={t}
    />
  );
}
