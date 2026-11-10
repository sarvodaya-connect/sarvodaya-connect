import { ProgrammesView } from "@/components/dashboard/programmes/programmes-view";
import { first } from "@/components/dashboard/national/format";
import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getNationalProgrammes, getScopedProgrammes } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

/**
 * V5 D07 Programmes & Activities. HQ sees the nation (`national/programmes`);
 * a DM, DDM or SPC sees the same page over the societies the API lets them
 * count (`programmes`, issue #117). The API decides the scope on every request.
 */
export default async function ProgrammesPage({ searchParams }: PageProps<"/activities">) {
  const viewer = await getDesktopViewer();
  const params = await searchParams;
  const year = Number(first(params.year)) || undefined;
  const [programmes, t] = await Promise.all([
    viewer.role === "HQ_ADMIN" ? getNationalProgrammes(year) : getScopedProgrammes(year),
    getT(),
  ]);
  return <ProgrammesView activityId={first(params.activity)} demo={isDemoMode()} programmes={programmes} role={viewer.role} t={t} />;
}
