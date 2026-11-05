import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentUpload } from "@/components/dashboard/documents/document-upload";
import { RegistrarDocumentsList } from "@/components/dashboard/documents/registrar-documents";
import { DocumentsList } from "@/components/dashboard/society-record/record-lists";
import { getRegistrarDocuments } from "@/lib/activities-api";
import { getAnnualSummary, getSocietyDocuments, getSocietyRecord } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { completeDocumentUpload, startDocumentUpload } from "../record-actions";

/** V5 D05 Documents tab and D12 for one society: the Registrar documents first, then every file. */
export default async function SocietyDocumentsPage({ params, searchParams }: PageProps<"/societies/[id]/documents">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const query = await searchParams;
  const year = Number(Array.isArray(query.year) ? query.year[0] : query.year) || undefined;
  const [record, registrar, summary, { data }] = await Promise.all([
    getSocietyRecord(id),
    getRegistrarDocuments(id, year),
    getAnnualSummary(id),
    getSocietyDocuments(id),
  ]);
  const years = summary.financialYears.map(({ startYear, label }) => ({ startYear, label }));
  return (
    <div className="mt-4 space-y-4">
      <nav aria-label="Financial Year" className="flex flex-wrap gap-2">
        {years.map((option) => {
          const active = option.startYear === registrar.financialYear.startYear;
          return (
            <Link
              aria-current={active ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                active ? "border-brand-forest bg-brand-forest text-white" : "border-line bg-surface text-ink-soft"
              }`}
              href={`/societies/${id}/documents?year=${option.startYear}`}
              key={option.startYear}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <RegistrarDocumentsList registrar={registrar} societyId={id} />
        {record.permissions.canUploadDocuments ? (
          <DocumentUpload
            allowAuditReport={record.permissions.canUploadAuditReport}
            complete={completeDocumentUpload.bind(null, id)}
            financialYears={years}
            start={startDocumentUpload.bind(null, id)}
          />
        ) : (
          <p className="rounded-card border border-line bg-surface p-4 text-[12px] text-ink-soft">
            Documents are uploaded by the society&apos;s Society Officer or SPC. HQ can open and download them; the signed
            members list is visible only to District Managers and HQ.
          </p>
        )}
      </div>
      <section aria-labelledby="all-documents-heading">
        <h2 className="text-[10px] font-bold tracking-[0.12em] text-ink-soft" id="all-documents-heading">All Documents</h2>
        <DocumentsList documents={data} societyId={id} />
      </section>
    </div>
  );
}
