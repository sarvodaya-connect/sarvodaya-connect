import { endsLabel, shortDateTime } from "@/lib/home-format";

import { Icon } from "../icon";
import { AccessBanner } from "../ui/access-banner";

/**
 * V5 DD06: a DDM opening a district society through temporary access sees it
 * view only, and that opening it was added to the access history.
 */
export function TemporaryRecordNotice({ until, viewerName, now = new Date() }: { until?: string; viewerName: string; now?: Date }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <AccessBanner tone="temporary">
        <strong>View only</strong> · temporary district-wide view{until ? ` ends ${endsLabel(until)}` : ""}. You cannot edit this society or request a grade change.
      </AccessBanner>
      <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-3.5 py-2 text-[11.5px] text-ink-soft">
        <Icon className="size-3.5 shrink-0" name="help" />
        Opening this record was added to the access history ({viewerName} · {shortDateTime(now.toISOString())}).
      </p>
    </div>
  );
}
