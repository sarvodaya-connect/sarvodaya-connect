import type { SocietyRegistrarDocuments } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { Pill } from "../ui/pill";
import { documentTypeLabel, formatSize } from "./document-labels";
import { ENGLISH } from "@/i18n/english";
import { actorName, recordDate } from "@/i18n/society-record";
import { formatNumber, type Translator } from "@/i18n/translate";

/** V5 M13 / D05 Documents: the four annual Registrar documents, "N of 4 uploaded". */
export function RegistrarDocumentsList({ registrar, societyId, t = ENGLISH }: { registrar: SocietyRegistrarDocuments; societyId: string; t?: Translator }) {
  const number = (value: number) => formatNumber(t.locale, value);
  return (
    <section aria-labelledby="registrar-heading" className="rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-ink" id="registrar-heading">
          {t("rd.registrarYear", { year: registrar.financialYear.label })}
        </h2>
        <p className="text-[12px] text-ink-soft">
          {t.rich("rd.uploadedTotal", {
            fraction: <strong className="text-ink">{t("au.xOfY", { x: number(registrar.submitted), y: number(4) })}</strong>,
          })}
          {registrar.missing > 0 ? ` · ${t("rd.missingCount", { count: number(registrar.missing) })}` : ""}
        </p>
      </div>
      <ol className="mt-3 divide-y divide-line-soft">
        {registrar.documents.map((entry, index) => {
          const doc = entry.document;
          const href = doc && `/societies/${societyId}/documents/${doc.id}/download`;
          return (
            <li className="flex flex-wrap items-center gap-3 py-3" key={entry.documentType}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eef1ec] text-[12px] font-bold text-ink-soft">
                {number(index + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">{documentTypeLabel(entry.documentType, t)}</p>
                {doc ? (
                  <p className="text-[11px] text-ink-soft">
                    {doc.fileName} · {formatSize(doc.sizeBytes, t)} · {t("rd.uploadedBy", { date: recordDate(t, doc.uploadedAt), actor: actorName(t, doc.uploadedBy) })}
                    {doc.version > 1 ? ` · ${t("rd.versionDetail", { version: number(doc.version) })}` : ""}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted">{t(`au.note.${entry.documentType}`)}</p>
                )}
              </div>
              {doc ? <Pill tone="verified">{t("au.uploaded")}</Pill> : <Pill tone="not-reported">{t("rd.submitted")}</Pill>}
              {doc && href && (
                doc.canOpen ? (
                  <span className="flex gap-2 text-[11px]">
                    <a className="font-semibold text-brand-leaf underline underline-offset-2" href={href} rel="noopener" target="_blank">{t("rd.open")}</a>
                    <a className="font-semibold text-brand-leaf underline underline-offset-2" download={doc.fileName} href={href}>{t("rd.download")}</a>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <Icon className="size-3.5" name="lock" /> {t("rd.restricted")}
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
