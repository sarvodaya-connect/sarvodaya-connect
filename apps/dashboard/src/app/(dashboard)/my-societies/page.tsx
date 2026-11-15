import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { RecheckOnReturn } from "@/components/dashboard/district-access/recheck-on-return";

import { MySocieties } from "@/components/dashboard/role-home/my-societies";
import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getHomeSocieties } from "@/lib/home-api";
import { parseSocietyFilters } from "@/lib/home-format";

/** V5 SP02 / DD03 / DM02. HQ uses the national society directory instead. */
export default async function MySocietiesPage({ searchParams }: PageProps<"/my-societies">) {
  const viewer = await getDesktopViewer();
  if (viewer.role === "HQ_ADMIN") redirect("/societies");
  const filters = parseSocietyFilters(await searchParams);
  // DD07: a DDM whose temporary access has ended goes back to their own societies.
  let list;
  try {
    list = await getHomeSocieties(filters);
  } catch (error) {
    if (filters.scope !== "DISTRICT" || !(error instanceof Error) || !/ended/i.test(error.message)) throw error;
    redirect("/my-societies");
  }
  const page = <MySocieties filters={filters} list={list} t={await getT()} role={viewer.role === "SYSTEM_ADMIN" ? undefined : viewer.role} />;
  // DD04: the district view exists only while temporary access lasts, so a copy
  // brought back with the browser's Back button is checked again first.
  return list.scope === "DISTRICT" ? <RecheckOnReturn token={randomUUID()}>{page}</RecheckOnReturn> : page;
}
