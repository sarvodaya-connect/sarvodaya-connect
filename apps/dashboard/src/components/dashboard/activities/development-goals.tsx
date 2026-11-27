import Image from "next/image";

import type { WorkPlanActivity } from "@sarvodaya-connect/api-contracts";

import type { Translator } from "@/i18n/translate";
import { ACTIVITY_CATEGORIES, ACTIVITY_DIMENSIONS } from "@/lib/v5-constants";
import { SdgChips } from "../sdg/sdg-chip";

type GoalsActivity = Pick<WorkPlanActivity, "status" | "classification" | "sdgs">;

export function DevelopmentGoals({ activity, embedded = false, t }: { activity: GoalsActivity; embedded?: boolean; t: Translator }) {
  const Heading = embedded ? "h3" : "h2";
  const GroupHeading = embedded ? "h4" : "h3";
  const approved = activity.status === "APPROVED";
  const dimensions = ACTIVITY_DIMENSIONS.filter((value) => activity.classification?.dimensions.includes(value));
  const categories = ACTIVITY_CATEGORIES.filter((value) => activity.classification?.categories.includes(value));
  const sdgs = [...new Set(activity.sdgs)].sort((a, b) => a - b);
  const hasClassification = dimensions.length > 0 && categories.length > 0;
  const groupDivider = embedded
    ? "border-t border-line-soft pt-3"
    : "border-t border-line-soft pt-3 xl:border-t-0 xl:pt-0";

  return (
    <section aria-labelledby="development-goals" className={embedded ? "mt-4 space-y-3 border-t border-line-soft pt-3" : "mt-4 space-y-3 rounded-card border border-line bg-surface p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading className="text-base font-bold text-ink" id="development-goals">{t("dg.heading")}</Heading>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-soft">{t("sr.viewOnly")}</span>
      </div>
      {!approved ? (
        <p className="text-sm text-ink-soft">{t(activity.status === "SENT_BACK" ? "dg.sentBack" : "dg.pending")}</p>
      ) : (
        <div className={embedded ? "grid gap-3" : "grid gap-3 xl:grid-cols-[2fr_2fr_1fr]"}>
          {hasClassification ? (
            <>
              <div>
                <GroupHeading className="mb-2 text-sm font-semibold text-ink">{t("dg.dimensions")}</GroupHeading>
                <ul className="flex flex-wrap gap-2">
                  {dimensions.map((dimension) => (
                    <li className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-brand-mint-soft px-2 py-1 pr-3 text-sm font-semibold text-ink" key={dimension}>
                      <Image alt="" className="shrink-0" height={38} src={`/development_goals/${dimension.toLowerCase()}.png`} width={38} />
                      {t(`dg.${dimension}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={groupDivider}>
                <GroupHeading className="mb-2 text-sm font-semibold text-ink">{t("dg.categories")}</GroupHeading>
                <ul className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <li className="rounded-md border border-line bg-surface-muted px-2.5 py-1 text-sm text-ink" key={category}>
                      {t(`dg.${category}`)}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className={`rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-soft ${embedded ? "" : "xl:col-span-2"}`}>{t("dg.legacy")}</p>
          )}
          <div className={groupDivider}>
            <GroupHeading className="mb-2 text-sm font-semibold text-ink">{t("dg.sdgs")}</GroupHeading>
            {sdgs.length ? <SdgChips sdgs={sdgs} t={t} /> : <p className="text-sm text-ink-soft">{t("dg.noSdgs")}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
