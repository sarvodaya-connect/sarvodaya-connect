import Link from "next/link";

import type { ScopedMembership } from "@sarvodaya-connect/api-contracts";

import { EmptyState } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { Breadcrumb, PageTitle, SampleBadge } from "@/components/dashboard/national/parts";
import type { Translator } from "@/i18n/translate";
import type { DemoViewer } from "@/lib/access";
import { endsLabel } from "@/lib/home-format";

import { CategoryHeading, CategoryTable, DistrictTable, MembershipStats, ProfileMembers } from "./membership-tables";

const tabClass = (active: boolean) =>
  `-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold ${active ? "border-brand-forest text-ink" : "border-transparent text-ink-soft hover:text-ink"}`;

/**
 * Issue #118: D08 Membership for a DM, DDM or SPC. The same cards and tables
 * as HQ, from the API's scoped figures. The profile members (issue #141) come
 * first and are never added to the yearly category counts below them.
 */
export function ScopedMembershipView({ demo, membership, t, viewer }: { demo: boolean; membership: ScopedMembership; t: Translator; viewer: DemoViewer }) {
  const year = membership.year;
  const district = membership.districts[0]?.name ?? viewer.scopeLabel;
  const scopeLine =
    membership.scope === "DISTRICT_MANAGER"
      ? t("mb.scopeDm", { district })
      : membership.scope === "DISTRICT"
        ? t("mb.scopeDistrict", { district, date: membership.districtView?.expiresAt ? endsLabel(membership.districtView.expiresAt, t) : "" })
        : t.plural("mb.scopeMine", membership.activeSocieties);
  const listHref = membership.scope === "DISTRICT" ? "/my-societies?scope=DISTRICT" : "/my-societies";

  return (
    <>
      <Breadcrumb current={t("nav.membership")} home={viewer.role === "DISTRICT_MANAGER" ? t("nav.districtOverview") : t("nav.home")} />
      <PageTitle
        actions={<SampleBadge demo={demo} label={year ? t("n.demoYear", { year }) : t("n.demoData")} />}
        description={year ? `${scopeLine} · ${t("mb.latestYear", { year })}` : scopeLine}
        title={t("nav.membership")}
      />

      {membership.districtView?.available && (
        <nav aria-label={t("ms.which")} className="mt-3 flex gap-1 border-b border-line">
          <Link aria-current={membership.scope === "MINE" ? "page" : undefined} className={tabClass(membership.scope === "MINE")} href="/membership">
            {t("mb.tabMine")}
          </Link>
          <Link aria-current={membership.scope === "DISTRICT" ? "page" : undefined} className={tabClass(membership.scope === "DISTRICT")} href="/membership?scope=DISTRICT">
            {t("mb.tabDistrict")}
          </Link>
        </nav>
      )}

      {membership.activeSocieties === 0 ? (
        <div className="mt-4">
          <EmptyState description={t("mb.noSocieties")} icon="society" title={t("mb.noSocietiesTitle")} />
        </div>
      ) : (
        <>
          <ProfileMembers profile={membership.profile} t={t} />
          <CategoryHeading profile={membership.profile} t={t} year={year} />
          {year === null && (
            <p className="mt-4 flex items-start gap-2.5 rounded-card border border-[#e8d28a] bg-warn-bg px-4 py-3 text-[12px] text-warn-text" role="status">
              <Icon className="mt-0.5 size-4 shrink-0" name="help" />
              <span>
                <strong className="block">{t("mb.noneYetTitle")}</strong>
                {t("mb.noneYet")}
              </span>
            </p>
          )}
          <MembershipStats membership={membership} t={t} />
          <CategoryTable membership={membership} t={t} />
          <DistrictTable href={() => listHref} membership={membership} t={t} />
        </>
      )}
    </>
  );
}
