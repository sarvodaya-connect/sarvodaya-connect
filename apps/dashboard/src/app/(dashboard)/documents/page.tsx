import Link from "next/link";

import { REGISTRAR_DOCUMENT_TYPES } from "@/lib/v5-constants";

import { EmptyState } from "@/components/dashboard/data-states";
import { documentTypeLabel, formatSize } from "@/components/dashboard/documents/document-labels";
import { RegistrarTotalsCards, allFourLabel } from "@/components/dashboard/documents/registrar-totals";
import { Icon } from "@/components/dashboard/icon";
import { Pill } from "@/components/dashboard/ui/pill";
import { getRegistrarTotals } from "@/lib/activities-api";
import { getCurrentViewer } from "@/lib/current-viewer";
import { isDemoMode, platformApi } from "@/lib/platform-api";
import { getT } from "@/i18n/server";
import { recordDate } from "@/i18n/society-record";
import { formatNumber } from "@/i18n/translate";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const OTHER_TYPES = ["REGISTRATION", "ACTIVITY_EVIDENCE", "FINANCE", "OTHER"] as const;
const ALL_TYPES: readonly string[] = [...REGISTRAR_DOCUMENT_TYPES, ...OTHER_TYPES];

type LibraryDocument = {
  id: string;
  societyId: string;
  society: { id: string; nameEn: string; societyCode: string };
  documentType: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  accessLevel: "STANDARD" | "REVIEWERS_ONLY";
  version: number;
  uploadedBy: string;
  uploadedAt?: string;
  updatedAt: string;
};

/** V5 D12 Documents (HQ only): the four Registrar documents first, then every uploaded file. */
export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  await getCurrentViewer();
  const t = await getT();
  const number = (value: number) => formatNumber(t.locale, value);
  const params = await searchParams;
  const type = ALL_TYPES.includes(first(params.type) ?? "") ? first(params.type)! : undefined;
  const page = Math.max(1, Number(first(params.page)) || 1);
  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (type) query.set("documentType", type);
  const [totals, list] = await Promise.all([
    getRegistrarTotals(),
    platformApi(`/documents?${query}`) as Promise<{ data: LibraryDocument[]; meta: { totalItems: number; totalPages: number } }>,
  ]);
  const counts = new Map(totals.documentCounts.map((entry) => [entry.documentType, entry.count]));
  const allCount = totals.documentCounts.reduce((sum, entry) => sum + entry.count, 0);
  const href = (next: { type?: string; page?: number }) => {
    const search = new URLSearchParams();
    if (next.type) search.set("type", next.type);
    if (next.page && next.page > 1) search.set("page", String(next.page));
    return `/documents${search.size ? `?${search}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">{t("nav.documents")}</h1>
          <p className="text-[12px] text-ink-soft">{t("rd.registrarFirst")}</p>
        </div>
        {isDemoMode() && <Pill tone="preview">{t("rd.sample")}</Pill>}
      </div>

      <section aria-labelledby="registrar-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[10px] font-bold tracking-[0.12em] text-ink-soft" id="registrar-heading">
            {t("rd.registrarYear", { year: totals.financialYear.label })}
          </h2>
          <p className="text-[12px] text-ink-soft">{allFourLabel(totals, t)}</p>
        </div>
        <RegistrarTotalsCards t={t} totals={totals} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={t("rd.types")} className="h-fit rounded-card border border-line bg-surface p-2">
          <ul className="space-y-0.5 text-[12px]">
            {[undefined, ...ALL_TYPES].map((value, index) => {
              const active = value === type;
              const count = value ? (counts.get(value as never) ?? 0) : allCount;
              const label = value
                ? `${index <= REGISTRAR_DOCUMENT_TYPES.length ? `${number(index)} · ` : ""}${documentTypeLabel(value, t)}`
                : t("rd.all");
              return (
                <li key={value ?? "all"}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`flex justify-between rounded-lg px-3 py-2 ${active ? "bg-brand-mint font-semibold text-ink" : "text-ink-soft hover:bg-[#f4f5f1]"}`}
                    href={href({ type: value })}
                  >
                    <span>{label}</span>
                    <span>{number(count)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section aria-label={t("rd.list")} className="rounded-card border border-line bg-surface">
          {list.data.length === 0 ? (
            <EmptyState
              description={t(type ? "rd.emptyType" : "rd.empty")}
              icon="document"
              title={t("rd.emptyTitle")}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead className="bg-[#f2f4f0] text-[11px] text-muted">
                    <tr>
                      {(["rd.name", "rd.society", "rd.version", "rd.updatedHeading", ""] as const).map((heading) => (
                        <th className="px-3 py-2.5 font-medium" key={heading} scope="col">{heading && t(heading)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {list.data.map((doc) => (
                      <tr key={doc.id}>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-2 font-semibold text-ink">
                            <Icon className="size-4 text-ink-soft" name={doc.accessLevel === "REVIEWERS_ONLY" ? "lock" : "document"} />
                            {doc.title}
                          </span>
                          <span className="block pl-6 text-[10px] text-muted">{doc.fileName} · {formatSize(doc.sizeBytes, t)} · {doc.uploadedBy}</span>
                        </td>
                        <td className="px-3 py-3">
                          <Link className="text-brand-forest underline underline-offset-2" href={`/societies/${doc.societyId}/documents`}>
                            {doc.society.nameEn}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-ink-soft">v{number(doc.version)}</td>
                        <td className="px-3 py-3 text-ink-soft">{recordDate(t, doc.uploadedAt ?? doc.updatedAt)}</td>
                        <td className="px-3 py-3 text-right">
                          {doc.uploadedAt ? (
                            <a
                              className="font-semibold text-brand-leaf underline underline-offset-2"
                              download={doc.fileName}
                              href={`/societies/${doc.societyId}/documents/${doc.id}/download`}
                            >
                              {t("rd.download")}<span className="sr-only">: {doc.title}</span>
                            </a>
                          ) : (
                            <span className="text-muted">{t("rd.uploading")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-3 py-2.5 text-[11px] text-muted">
                <span>{t("rd.showing", { shown: number(list.data.length), total: number(list.meta.totalItems) })}</span>
                <span className="flex gap-3">
                  {page > 1 && <Link className="font-semibold text-brand-forest underline" href={href({ type, page: page - 1 })}>{t("rd.previous")}</Link>}
                  <span>{t("rd.page", { page: number(page), total: number(Math.max(1, list.meta.totalPages)) })}</span>
                  {page < list.meta.totalPages && <Link className="font-semibold text-brand-forest underline" href={href({ type, page: page + 1 })}>{t("rd.next")}</Link>}
                </span>
              </div>
            </>
          )}
        </section>
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-card border border-line bg-surface px-4 py-3 text-[12px] text-ink-soft">
        <Icon className="mt-0.5 size-4 shrink-0" name="help" />
        {t("rd.permissions")}
      </p>
    </>
  );
}
