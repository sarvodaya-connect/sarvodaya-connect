import { ENGLISH } from "@/i18n/english";
import type { Translator } from "@/i18n/translate";
import { endsLabel, shortDateTime } from "@/lib/home-format";

import { Icon } from "../icon";
import { AccessBanner } from "../ui/access-banner";

/**
 * V5 DD06: a DDM opening a district society through temporary access sees it
 * view only, and that opening it was added to the access history.
 */
export function TemporaryRecordNotice({
  until,
  viewerName,
  now = new Date(),
  t = ENGLISH,
}: {
  until?: string;
  viewerName: string;
  now?: Date;
  t?: Translator;
}) {
  const viewOnly = <strong>{t("sr.viewOnly")}</strong>;
  return (
    <div className="mt-3 flex flex-col gap-2">
      <AccessBanner tone="temporary">
        {until ? t.rich("sr.tempNoticeEnds", { viewOnly, date: endsLabel(until, t) }) : t.rich("sr.tempNotice", { viewOnly })}
      </AccessBanner>
      <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted px-3.5 py-2 text-[11.5px] text-ink-soft">
        <Icon className="size-3.5 shrink-0" name="help" />
        {t("sr.openedRecorded", { name: viewerName, time: shortDateTime(now.toISOString(), t) })}
      </p>
    </div>
  );
}
