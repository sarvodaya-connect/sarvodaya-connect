import { getT } from "@/i18n/server";

import { Icon } from "../icon";

/** V6 SP06–SP09 rule banner. */
export async function ApprovalRuleNotice() {
  const t = await getT();
  return (
    <p className="flex items-start gap-2.5 rounded-card border border-[#cfe2cf] bg-[#e8f2e6] px-4 py-2.5 text-[12px] text-ink-soft">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-forest" name="shield" />
      <span>{t.rich("goals.notice", { strong: <strong className="text-ink">{t("goals.noticeStrong")}</strong> })}</span>
    </p>
  );
}
