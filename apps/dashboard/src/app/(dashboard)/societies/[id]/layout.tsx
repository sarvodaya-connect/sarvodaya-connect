import { TemporaryRecordNotice } from "@/components/dashboard/district-access/record-access-notice";
import { RecordHeader } from "@/components/dashboard/society-record/record-header";
import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getGradeRequests, getSocietyDocuments, getSocietyRecord, getWorkPlan } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

/**
 * SC-65 D05 society record. API-backed records (UUID ids) share this header
 * and tab row; older demonstration profiles render unchanged.
 */
export default async function SocietyRecordLayout({ children, params }: LayoutProps<"/societies/[id]">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) return children;
  const [viewer, record, t] = await Promise.all([getDesktopViewer(), getSocietyRecord(id), getT()]);
  // Tab counts are helpful but not essential; a failed count leaves it blank.
  const [plan, documents, requests] = await Promise.all([
    getWorkPlan(id).catch(() => null),
    getSocietyDocuments(id).catch(() => null),
    getGradeRequests(id).catch(() => null),
  ]);
  const base = `/societies/${id}`;
  return (
    <>
      <RecordHeader
        isHq={viewer.role === "HQ_ADMIN"}
        record={record}
        t={t}
        tabs={[
          { href: base, label: t("sr.tab.overview") },
          { count: record.committee.filter((member) => member.isActive).length, href: `${base}/exco`, label: "Exco" },
          {
            count: plan?.activities.length,
            href: `${base}/work-plan`,
            label: plan ? t("sr.tab.workPlanYear", { year: plan.year }) : t("sr.tab.workPlan"),
          },
          { count: documents?.total, href: `${base}/documents`, label: t("nav.documents") },
          { count: requests?.length, href: `${base}/grade`, label: t("sr.tab.grade") },
          { href: `${base}/history`, label: t("sr.tab.history") },
        ]}
      />
      {record.permissions.viewOnlyReason === "TEMPORARY_DISTRICT_ACCESS" && (
        <TemporaryRecordNotice t={t} until={record.permissions.viewOnlyUntil} viewerName={viewer.displayName} />
      )}
      {children}
    </>
  );
}
