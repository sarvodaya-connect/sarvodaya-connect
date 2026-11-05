import { notFound } from "next/navigation";

import { first } from "@/components/dashboard/national/parts";
import { PrintButton } from "@/components/dashboard/national/print-button";
import { ReportTableView } from "@/components/dashboard/national/report-table";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getReport } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";
import { isReportType } from "@/lib/reports";

/** V5 D15 "Download PDF": a print-ready page; the browser saves it as PDF. */
export default async function PrintReportPage({ params, searchParams }: PageProps<"/reports/[type]">) {
  await getCurrentViewer();
  const { type } = await params;
  if (!isReportType(type)) notFound();
  const search = await searchParams;
  const report = await getReport(type, {
    year: Number(first(search.year)) || undefined,
    districtId: first(search.districtId) || undefined,
  });
  return (
    <main className="mx-auto w-full max-w-4xl bg-white px-8 py-8 text-ink">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.08em] text-brand-forest">Sarvodaya Connect · Report</p>
          <h1 className="text-[22px] font-bold">{report.title}</h1>
          <p className="text-[12px] text-ink-soft">
            {report.scope} · {report.financialYear.label} · figures from approved records · generated{" "}
            {new Date(report.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" })}
          </p>
          {isDemoMode() && <p className="mt-1 text-[11px] font-semibold text-warn-text">Demonstration data · sample figures, not real</p>}
        </div>
        <PrintButton />
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-line">
        <ReportTableView report={report} />
      </div>
      <p className="mt-4 text-[10px] text-muted">Counts and yearly totals only. No names, NICs or contact details are included.</p>
    </main>
  );
}
