import { redirect } from "next/navigation";

import { CategoryTable, DistrictTable, MembershipStats } from "@/components/dashboard/membership/membership-tables";
import { ScopedMembershipView } from "@/components/dashboard/membership/scoped-membership";
import { Breadcrumb, PageTitle, SampleBadge } from "@/components/dashboard/national/parts";
import { first } from "@/components/dashboard/national/format";
import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getHomeMembership } from "@/lib/home-api";
import { getNationalMembership } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

/**
 * V5 D08 Membership: counts only, no personal data. HQ sees the national
 * figures; a DM, DDM or SPC sees the same view for their own scope (issue #118).
 */
export default async function MembershipPage({ searchParams }: PageProps<"/membership">) {
  const viewer = await getDesktopViewer();
  const t = await getT();

  if (viewer.role !== "HQ_ADMIN") {
    const scope = first((await searchParams).scope) === "DISTRICT" ? "DISTRICT" : undefined;
    let membership;
    try {
      membership = await getHomeMembership(scope);
    } catch (error) {
      // A DDM whose temporary access has ended goes back to their own societies.
      if (scope !== "DISTRICT" || !(error instanceof Error) || !/ended/i.test(error.message)) throw error;
      redirect("/membership");
    }
    return <ScopedMembershipView demo={isDemoMode()} membership={membership} t={t} viewer={viewer} />;
  }

  const membership = await getNationalMembership();
  const year = membership.year;
  return (
    <>
      <Breadcrumb current={t("nav.membership")} />
      <PageTitle
        actions={<SampleBadge demo={isDemoMode()} label={year ? t("n.demoYear", { year }) : t("n.demoData")} />}
        description={year ? t("mb.countsYear", { year }) : t("mb.counts")}
        title={t("nav.membership")}
      />
      <MembershipStats membership={membership} t={t} />
      <CategoryTable membership={membership} t={t} />
      <DistrictTable href={(id) => `/societies?districtId=${id}`} membership={membership} t={t} />
    </>
  );
}
