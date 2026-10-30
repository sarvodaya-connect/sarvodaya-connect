import { RecordHeader } from "@/components/dashboard/society-record/record-header";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getGradeRequests, getSocietyDocuments, getSocietyRecord, getWorkPlan } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

/**
 * SC-65 D05 society record. API-backed records (UUID ids) share this header
 * and tab row; older demonstration profiles render unchanged.
 */
export default async function SocietyRecordLayout({ children, params }: LayoutProps<"/societies/[id]">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) return children;
  await getCurrentViewer();
  const record = await getSocietyRecord(id);
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
        record={record}
        tabs={[
          { href: base, label: "Overview" },
          { count: record.committee.filter((member) => member.isActive).length, href: `${base}/exco`, label: "Exco" },
          { count: plan?.activities.length, href: `${base}/work-plan`, label: `Work plan${plan ? ` ${plan.year}` : ""}` },
          { count: documents?.total, href: `${base}/documents`, label: "Documents" },
          { count: requests?.length, href: `${base}/grade`, label: "Grade" },
          { href: `${base}/history`, label: "History" },
        ]}
      />
      {children}
    </>
  );
}
