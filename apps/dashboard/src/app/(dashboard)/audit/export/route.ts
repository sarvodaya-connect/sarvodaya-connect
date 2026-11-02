import type { AuditLogEntry } from "@sarvodaya-connect/api-contracts";

import { auditCsv, auditQuery, parseAuditFilters } from "@/lib/audit-log";
import { getCurrentViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

/** V5 D24 "Export log": the filtered log as CSV. The API applies the viewer's scope. */
export async function GET(request: Request) {
  await getCurrentViewer();
  const filters = parseAuditFilters(Object.fromEntries(new URL(request.url).searchParams));
  const { data }: { data: AuditLogEntry[] } = await platformApi(`/identity/audit?${auditQuery(filters)}`);
  return new Response(auditCsv(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="change-and-access-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
