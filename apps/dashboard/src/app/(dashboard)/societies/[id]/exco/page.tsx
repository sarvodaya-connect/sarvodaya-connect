import { notFound } from "next/navigation";

import { ExcoTable } from "@/components/dashboard/society-record/exco-table";
import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getSocietyRecord } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { revealMemberNic } from "../record-actions";

/** V5 D05x: the society's Exco with masked NICs, and Edit Exco for those who may edit. */
export default async function SocietyExcoPage({ params }: PageProps<"/societies/[id]/exco">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const [viewer, record, t] = await Promise.all([getDesktopViewer(), getSocietyRecord(id), getT()]);
  const accessNote =
    viewer.role === "HQ_ADMIN"
      ? t("sr.ex.accessHq")
      : record.permissions.viewOnlyReason === "TEMPORARY_DISTRICT_ACCESS"
        ? t("sr.ex.accessTemporary")
        : record.permissions.viewOnlyReason === "DISTRICT_MANAGER"
          ? t("sr.ex.accessDistrict")
          : t("sr.ex.accessAssigned");
  return (
    <ExcoTable
      accessNote={accessNote}
      editHref={record.permissions.canEdit ? `/societies/${id}/exco/edit` : undefined}
      members={record.committee}
      revealNic={revealMemberNic.bind(null, id)}
      status={record.excoStatus}
    />
  );
}
