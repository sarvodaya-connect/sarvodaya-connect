import { openIncident } from "@/app/(dashboard)/emergencies/actions";
import { SHORT_ROLE_LABELS, type DemoViewer } from "@/lib/access";
import { failureMessage, getReportOptions, type ReportOptions } from "@/lib/emergency-api";

import { secondaryButtonClass } from "../data-states";
import { OpenIncidentForm } from "./incident-forms";
import { Drawer, Modal } from "./incident-view";

/**
 * V5 D30 "Open an incident" (HQ side panel) and IR02 "Report an incident"
 * (SPC, DDM and DM dialog). The society list holds only the societies the
 * user looks after; HQ can search every society.
 */
export async function OpenIncidentPanel({ viewer, closeHref, search }: { viewer: DemoViewer; closeHref: string; search?: string }) {
  const isHq = viewer.role === "HQ_ADMIN";
  let options: ReportOptions | null = null;
  let error: string | null = null;
  try {
    options = await getReportOptions(isHq ? search : undefined);
  } catch (failure) {
    error = failureMessage(failure);
  }
  const body = error ? (
    <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
      {error}
    </p>
  ) : !options?.societies.length && !search ? (
    <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">
      You have no assigned societies to report for. Ask HQ to check your account.
    </p>
  ) : (
    <>
      {isHq && (
        <form action="" className="mb-4 flex items-end gap-2" method="get">
          <input name="panel" type="hidden" value="open" />
          <label className="flex-1 text-[12px] font-semibold text-ink">
            Find the reporting society
            <input
              className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring"
              defaultValue={search}
              maxLength={150}
              name="q"
              placeholder="Society name or S number"
              type="search"
            />
          </label>
          <button className={secondaryButtonClass} type="submit">Find</button>
        </form>
      )}
      <OpenIncidentForm
        action={openIncident}
        closeHref={closeHref}
        districts={options!.districts}
        key={search ?? ""}
        now={new Date()}
        openerLine={`${viewer.displayName}, ${SHORT_ROLE_LABELS[viewer.role]}`}
        societies={options!.societies}
        variant={isHq ? "hq" : "role"}
      />
    </>
  );
  return isHq ? (
    <Drawer closeHref={closeHref} subtitle="Anyone signed in can open an incident for a society they look after. People covering the area are notified." title="Open an Incident">
      {body}
    </Drawer>
  ) : (
    <Modal closeHref={closeHref} subtitle="Opens a disaster incident" title="Report an Incident">
      {body}
    </Modal>
  );
}
