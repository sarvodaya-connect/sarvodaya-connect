import Link from "next/link";

import { NoPermissionState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { DocumentLibrary } from "@/components/dashboard/document-library";
import { PageHeading } from "@/components/dashboard/page-heading";
import { canSeeSociety, canViewCompliance, canViewDocument, canViewDocumentLibrary } from "@/lib/access";
import { getCurrentViewer } from "@/lib/current-viewer";
import { complianceRecords } from "@/lib/demo-compliance";
import { DOCUMENT_TYPES, EMPTY_DOCUMENT_FILTERS, libraryDocuments } from "@/lib/demo-documents";
import { districts } from "@/lib/demo-registry";
import { loadDemoList, parseDemoScenario } from "@/lib/demo-scenarios";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const roleNotices = {
  DISTRICT_MANAGER: "You see documents from societies in your district only.",
  PROGRAMME_COORDINATOR:
    "You see activity and registration documents for your assigned societies. Audit, Registrar, finance and signed members-list files are not shown for your role.",
} as const;

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const params = await searchParams;
  const viewer = await getCurrentViewer();
  const heading = (
    <PageHeading
      description="Every certificate, minute and report from the societies you can see. The four Registrar documents come first; search also looks inside scanned text."
      title="Documents"
    />
  );

  if (!canViewDocumentLibrary(viewer)) {
    return (
      <>
        {heading}
        <section className="mt-6 rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
          <NoPermissionState
            action={<Link className={secondaryButtonClass} href="/notifications">Go to notifications</Link>}
            description="System Administrators manage technical settings and do not see society documents."
            title="Documents are not available for your role"
          />
        </section>
      </>
    );
  }

  // Restricted documents are removed here, so they never reach the browser.
  const documents = await loadDemoList(
    parseDemoScenario(params.demo),
    libraryDocuments.filter((document) => canViewDocument(viewer, document)),
  );
  const recordsInScope = complianceRecords.filter((record) => canSeeSociety(viewer, record));
  const districtsInScope = districts.filter((district) => recordsInScope.some((record) => record.districtId === district.id));
  const societies = recordsInScope.map((record) => ({ id: record.societyId, name: record.societyName }));

  const society = first(params.society);
  const type = first(params.type);
  const initialFilters = {
    ...EMPTY_DOCUMENT_FILTERS,
    societyId: societies.some((item) => item.id === society) ? society! : "all",
    type: DOCUMENT_TYPES.some((item) => item.value === type) ? type! : "all",
  };

  return (
    <>
      {heading}
      <DocumentLibrary
        districts={districtsInScope}
        documents={documents}
        initialFilters={initialFilters}
        registrarRecords={canViewCompliance(viewer) ? recordsInScope : undefined}
        roleNotice={viewer.role in roleNotices ? roleNotices[viewer.role as keyof typeof roleNotices] : undefined}
        societies={societies}
      />
    </>
  );
}
