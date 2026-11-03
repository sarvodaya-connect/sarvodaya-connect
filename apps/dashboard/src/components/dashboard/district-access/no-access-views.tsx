import Link from "next/link";

import type { HomeSummary } from "@sarvodaya-connect/api-contracts";

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
}: {
  isHq: boolean;
  assigned?: number;
  recentlyEnded?: HomeSummary["recentlyEnded"];
}) {
  if (isHq) {
    return (
      <NoAccessState
        action={<Link className={primaryButtonClass} href="/societies">Go to societies</Link>}
        description="This society record does not exist or may have been removed."
        heading="h1"
        title="Society not found"
      />
    );
  }
  const yours = assigned === undefined ? "your assigned societies" : `your ${assigned} assigned ${assigned === 1 ? "society" : "societies"}`;
  return (
    <NoAccessState
      action={
        <span className="flex flex-wrap justify-center gap-2.5">
          <Link className={primaryButtonClass} href="/my-societies">Back to my societies</Link>
          <Link className={secondaryButtonClass} href="/dashboard">Home</Link>
        </span>
      }
      description={
        recentlyEnded
          ? `This society is not one of ${yours}, and your temporary district-wide view ended on ${endsLabel(recentlyEnded.endedAt)}. Ask your DM if you need it again.`
          : `This society is not one of ${yours}, so it cannot be opened. Ask your DM or HQ if you need it.`
      }
      heading="h1"
      title="You don't have access to this society"
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
      title={page === "sarvoai" ? "SarvoAI is for HQ only" : "This page is for HQ only"}
    />
  );
}
