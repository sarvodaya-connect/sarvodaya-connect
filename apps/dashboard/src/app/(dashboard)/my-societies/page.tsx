import { redirect } from "next/navigation";

import { MySocieties } from "@/components/dashboard/role-home/my-societies";
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
  return <MySocieties filters={filters} list={list} role={viewer.role === "SYSTEM_ADMIN" ? undefined : viewer.role} />;
}
