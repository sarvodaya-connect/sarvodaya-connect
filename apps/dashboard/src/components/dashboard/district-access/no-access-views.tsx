import Link from "next/link";

import type { HomeSummary } from "@sarvodaya-connect/api-contracts";

import { ENGLISH } from "@/i18n/english";
import type { Translator } from "@/i18n/translate";
import { endsLabel } from "@/lib/home-format";

import { NoAccessState, primaryButtonClass, secondaryButtonClass } from "../data-states";

/**
 * V5 ST04 / M26: a society the user cannot open. It names no society and
 * shows no record details, so a stale or shared link reveals nothing.
 */
export function SocietyNoAccess({
  isHq,
  assigned,
  recentlyEnded,
  t = ENGLISH,
}: {
  isHq: boolean;
  assigned?: number;
  recentlyEnded?: HomeSummary["recentlyEnded"];
  t?: Translator;
}) {
  if (isHq) {
    return (
      <NoAccessState
        action={<Link className={primaryButtonClass} href="/societies">{t("st.society.goToSocieties")}</Link>}
        description={t("st.society.notFoundBody")}
        heading="h1"
        t={t}
        title={t("st.society.notFoundTitle")}
      />
    );
  }
  const ended = recentlyEnded ? endsLabel(recentlyEnded.endedAt, t) : undefined;
  const description =
    assigned === undefined
      ? ended
        ? t("st.society.ended", { date: ended })
        : t("st.society.notYours")
      : ended
        ? t.plural("st.society.endedCount", assigned, { date: ended })
        : t.plural("st.society.notYoursCount", assigned);
  return (
    <NoAccessState
      action={
        <span className="flex flex-wrap justify-center gap-2.5">
          <Link className={primaryButtonClass} href="/my-societies">{t("st.society.backMine")}</Link>
          <Link className={secondaryButtonClass} href="/dashboard">{t("nav.home")}</Link>
        </span>
      }
      description={description}
      heading="h1"
      t={t}
      title={t("st.society.noAccessTitle")}
    />
  );
}

/** V5 M69d (desktop too): a page for another role, here HQ. */
export function RolePageNoAccess({
  name,
  page = "hq",
  roleLabel,
  scope,
}: {
  name: string;
  page?: "hq" | "sarvoai";
  roleLabel: string;
  scope: string;
}) {
  return (
    <NoAccessState
      action={<Link className={secondaryButtonClass} href="/dashboard">Go to my home</Link>}
      description={
        page === "sarvoai"
          ? `You are signed in as ${name} (${roleLabel}, ${scope}). This link opens an HQ tool, so nothing from it is shown here. Your own societies are on your home page.`
          : `You are signed in as ${name} (${roleLabel}, ${scope}). You can see the figures for your own societies on your home page.`
      }
      heading="h1"
      title={page === "sarvoai" ? "SarvoAI Is for HQ Only" : "This Page Is for HQ Only"}
    />
  );
}
