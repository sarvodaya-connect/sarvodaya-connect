import { getCurrentViewer } from "@/lib/current-viewer";
import { getReport } from "@/lib/national-api";
import { isReportType, reportCsv } from "@/lib/reports";

/** V5 D15 "Download Excel": the report as CSV. The API checks HQ access. */
export async function GET(request: Request, { params }: RouteContext<"/reports/[type]/download">) {
  await getCurrentViewer();
  const { type } = await params;
  if (!isReportType(type)) return new Response("Report not found", { status: 404 });
  const search = new URL(request.url).searchParams;
  const report = await getReport(type, {
    year: Number(search.get("year")) || undefined,
    districtId: search.get("districtId") || undefined,
  });
  return new Response(reportCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${report.financialYear.startYear}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
