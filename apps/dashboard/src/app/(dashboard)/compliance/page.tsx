import Link from "next/link";

import { ComplianceOverview } from "@/components/dashboard/compliance-overview";
import { NoPermissionState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { PageHeading } from "@/components/dashboard/page-heading";
import { canSeeSociety, canViewCompliance } from "@/lib/access";
import { getCurrentViewer } from "@/lib/current-viewer";
import {
  COMPLIANCE_YEAR,
  type ComplianceFilters,
  complianceRecords,
  EMPTY_COMPLIANCE_FILTERS,
  REGISTRAR_DOCUMENTS,
  REQUIREMENT_STATES,
} from "@/lib/demo-compliance";
import { districts } from "@/lib/demo-registry";
import { loadDemoList, parseDemoScenario } from "@/lib/demo-scenarios";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CompliancePage({ searchParams }: PageProps<"/compliance">) {
  const params = await searchParams;
  const viewer = await getCurrentViewer();
  const heading = (
    <PageHeading
      description={`Audit reports and the other annual Registrar documents for ${COMPLIANCE_YEAR}. Select a status or a document to filter the list.`}
      title="Audits & compliance"
    />
  );

  if (!canViewCompliance(viewer)) {
    return (
      <>
        {heading}
        <section className="mt-6 rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
          <NoPermissionState
            action={<Link className={secondaryButtonClass} href="/notifications">Go to notifications</Link>}
            description={`${viewer.roleLabel}s cannot see audit and Registrar records. District Managers and HQ monitor document compliance.`}
            title="Compliance is not available for your role"
          />
        </section>
      </>
    );
  }

  const records = await loadDemoList(
    parseDemoScenario(params.demo),
    complianceRecords.filter((record) => canSeeSociety(viewer, record)),
  );
  const districtsInScope = districts.filter((district) =>
    complianceRecords.some((record) => record.districtId === district.id && canSeeSociety(viewer, record)),
  );

  // Links from notifications can open the list already filtered.
  const district = first(params.district);
  const type = first(params.type);
  const status = first(params.status);
  const initialFilters: ComplianceFilters = {
    ...EMPTY_COMPLIANCE_FILTERS,
    districtId: districtsInScope.some((item) => item.id === district) ? district! : "all",
    type: REGISTRAR_DOCUMENTS.find((item) => item.type === type)?.type ?? "all",
    state: REQUIREMENT_STATES.find((item) => item.value === status)?.value ?? "all",
  };

  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {heading}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft">
            <option>FY {COMPLIANCE_YEAR}</option>
          </select>
          <div className="rounded-card border border-line bg-surface px-4 py-2">
            <span className="text-[11px] text-muted">Showing</span>
            <strong className="ml-2 text-[13px] text-ink">{viewer.scopeLabel}</strong>
          </div>
        </div>
      </div>
      <ComplianceOverview districts={districtsInScope} initialFilters={initialFilters} records={records} />
    </>
  );
}
