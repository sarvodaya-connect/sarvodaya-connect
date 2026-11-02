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
  return <MySocieties filters={filters} list={await getHomeSocieties(filters)} />;
}
