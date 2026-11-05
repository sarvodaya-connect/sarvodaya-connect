import type { SocietyRegistrarDocuments } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { Pill } from "../ui/pill";
import { REGISTRAR_LABELS, formatSize } from "./document-labels";
import { actorLabel, formatDate } from "@/lib/society-record-format";

/** V5 M13 / D05 Documents: the four annual Registrar documents, "N of 4 uploaded". */
export function RegistrarDocumentsList({ registrar, societyId }: { registrar: SocietyRegistrarDocuments; societyId: string }) {
  return (
    <section aria-labelledby="registrar-heading" className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink" id="registrar-heading">
          Annual Documents to the Registrar · {registrar.financialYear.label}
        </h2>
        <p className="text-[12px] text-ink-soft">
          <strong className="text-ink">{registrar.submitted} of 4</strong> uploaded
          {registrar.missing > 0 ? ` · ${registrar.missing} missing` : ""}
        </p>
      </div>
      <ol className="mt-3 divide-y divide-line-soft">
        {registrar.documents.map((entry, index) => {
          const label = REGISTRAR_LABELS[entry.documentType];
          const doc = entry.document;
          const href = doc && `/societies/${societyId}/documents/${doc.id}/download`;
          return (
            <li className="flex flex-wrap items-center gap-3 py-3" key={entry.documentType}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eef1ec] text-[12px] font-bold text-ink-soft">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">{label.title}</p>
                {doc ? (
                  <p className="text-[11px] text-ink-soft">
                    {doc.fileName} · {formatSize(doc.sizeBytes)} · uploaded {formatDate(doc.uploadedAt)} by {actorLabel(doc.uploadedBy)}
                    {doc.version > 1 ? ` · version ${doc.version}` : ""}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted">{label.note}</p>
                )}
              </div>
              {doc ? <Pill tone="verified">Uploaded</Pill> : <Pill tone="not-reported">Not submitted</Pill>}
              {doc && href && (
                doc.canOpen ? (
                  <span className="flex gap-2 text-[11px]">
                    <a className="font-semibold text-brand-leaf underline underline-offset-2" href={href} rel="noopener" target="_blank">Open</a>
                    <a className="font-semibold text-brand-leaf underline underline-offset-2" download={doc.fileName} href={href}>Download</a>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <Icon className="size-3.5" name="lock" /> DM and HQ only
                  </span>
                )
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
