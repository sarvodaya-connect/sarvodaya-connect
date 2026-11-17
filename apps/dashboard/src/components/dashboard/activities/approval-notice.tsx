import { ENGLISH } from "@/i18n/english";
import type { Translator } from "@/i18n/translate";

import { Icon } from "../icon";

/** V6 SP06–SP08 rule banner: the SPC chooses the Development Goals (#170). */
export function ApprovalRuleNotice({ t = ENGLISH }: { t?: Translator }) {
  return (
    <p className="flex items-start gap-2.5 rounded-card border border-[#cfe2cf] bg-[#e8f2e6] px-4 py-2.5 text-[12px] text-ink-soft">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-forest" name="shield" />
      <span>{t.rich("dg.notice", { choose: <strong className="text-ink">{t("dg.noticeChoose")}</strong> })}</span>
    </p>
  );
}
