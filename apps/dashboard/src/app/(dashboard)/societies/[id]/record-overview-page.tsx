import { AssignStaffPanel } from "@/components/dashboard/society-record/assign-staff-panel";
import { EditSocietyPanel } from "@/components/dashboard/society-record/edit-society-panel";
import { RecordOverview } from "@/components/dashboard/society-record/record-overview";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getSocietyRecord, getStaffOptions, getWorkPlan } from "@/lib/society-record-api";

import { assignStaff, updateSocietyRecord } from "./record-actions";

/** D05 / D05m overview, with the D05e edit panel (`?panel=edit`) and the D05a staff panel (`?panel=assign`, HQ). */
export async function RecordOverviewPage({ id, panel, saved }: { id: string; panel?: string; saved?: boolean }) {
  const viewer = await getCurrentViewer();
  const isHq = viewer.role === "HQ_ADMIN";
  const [record, plan, staffOptions] = await Promise.all([
    getSocietyRecord(id),
    getWorkPlan(id).catch(() => null),
    panel === "assign" && isHq ? getStaffOptions(id) : null,
  ]);
  return (
    <>
      {saved && (
        <p className="mt-4 rounded-card border border-[#c6e2cd] bg-success-bg px-4 py-2.5 text-[12px] font-semibold text-success-text" role="status">
          Changes saved. They are in the society history with your name and the time.
        </p>
      )}
      <RecordOverview canAssign={isHq} record={record} workPlan={plan} />
      {panel === "edit" && record.permissions.canEdit && (
        <EditSocietyPanel action={updateSocietyRecord.bind(null, id)} hqName={viewer.displayName} record={record} />
      )}
      {staffOptions && <AssignStaffPanel action={assignStaff.bind(null, id)} options={staffOptions} record={record} />}
    </>
  );
}
