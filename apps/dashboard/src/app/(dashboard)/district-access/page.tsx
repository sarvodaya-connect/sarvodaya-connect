import Link from "next/link";

import { GiveAccessForm, EndAccessButton } from "@/components/dashboard/district-access/access-controls";
import { CurrentGrant, DmAccessBanner, Drawer, GrantDetail, GrantHistoryTable, GrantStatus } from "@/components/dashboard/district-access/district-access-view";
import { NoAccessState } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { getT } from "@/i18n/server";
import { getDesktopViewer } from "@/lib/current-viewer";
import { getDistrictAccess, getDistrictAccessGrant, getDistrictDeputies } from "@/lib/district-access-api";
import { getHome } from "@/lib/home-api";

import { endDistrictAccess, giveDistrictAccess } from "./actions";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * V5 DM04 (with DM05 "Give temporary access" as `?panel=give` and the access
 * history as `?grant=<id>`). Only the District Manager opens this page; the
 * API checks the DM's district on every request.
 */
export default async function DistrictAccessPage({ searchParams }: PageProps<"/district-access">) {
  const viewer = await getDesktopViewer();
  const t = await getT();
  if (viewer.role !== "DISTRICT_MANAGER") {
    return (
      <NoAccessState
        action={<Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/dashboard">{t("da.goHome")}</Link>}
        description={t("da.onlyDm")}
        heading="h1"
        title={t("da.forDms")}
      />
    );
  }
  const params = await searchParams;
  const panel = first(params.panel);
  const grantId = first(params.grant);
  const now = new Date();
  const [list, home, deputies, detail] = await Promise.all([
    getDistrictAccess(),
    getHome(),
    panel === "give" ? getDistrictDeputies() : Promise.resolve([]),
    grantId && /^[0-9a-f-]{36}$/i.test(grantId) ? getDistrictAccessGrant(grantId).catch(() => null) : Promise.resolve(null),
  ]);
  const districtName = home.district?.name ?? t("da.yourDistrict");
  const societyCount = home.societies.total;
  const current = list.data.filter((g) => g.status === "ACTIVE" || g.status === "SCHEDULED");
  const given = first(params.given);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">{t("home.tempDdm")}</h1>
          <p className="text-[12.5px] text-ink-soft">{t("da.description", { district: districtName })}</p>
        </div>
        <Link className="inline-flex h-[38px] items-center gap-1.5 rounded-button bg-brand-action px-4 text-[13px] font-semibold text-white hover:bg-brand-action-pressed" href="/district-access?panel=give">
          <Icon className="size-4" name="key" strokeWidth={2} />
          {t("home.giveAccess")}
        </Link>
      </div>

      <DmAccessBanner districtName={districtName} societyCount={societyCount} t={t} />
      {given && (
        <p className="rounded-card border border-[#c6e2cd] bg-success-bg px-4 py-2.5 text-[12px] font-semibold text-success-text" role="status">
          {t("da.given")}
        </p>
      )}
      {first(params.ended) && (
        <p className="rounded-card border border-[#c6e2cd] bg-success-bg px-4 py-2.5 text-[12px] font-semibold text-success-text" role="status">
          {t("da.ended")}
        </p>
      )}
      {first(params.endFailed) && (
        <p className="rounded-card border border-[#efc4bd] bg-danger-bg px-4 py-2.5 text-[12px] font-semibold text-danger-text" role="alert">
          {t("da.endFailed")}
        </p>
      )}

      <section aria-labelledby="current-heading" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("da.activeNow")}</p>
            <h2 className="text-[15px] font-bold text-ink" id="current-heading">{current.length > 1 ? t("da.currentMany") : t("da.currentOne")}</h2>
          </div>
          {current[0] && <GrantStatus grant={current[0]} t={t} />}
        </div>
        {current.length ? (
          current.map((grant) => (
            <CurrentGrant
              endButton={<EndAccessButton action={endDistrictAccess} deputyName={grant.deputy.name} grantId={grant.id} returnTo="/district-access" />}
              grant={grant}
              key={grant.id}
              now={now}
              t={t}
            />
          ))
        ) : (
          <p className="text-[12.5px] text-ink-soft">{t("da.noneNow")}</p>
        )}
      </section>

      <section aria-labelledby="history-table-heading" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("da.history")}</p>
          <h2 className="text-[15px] font-bold text-ink" id="history-table-heading">{t("da.grantsGiven")}</h2>
        </div>
        <GrantHistoryTable grants={list.data} t={t} />
      </section>

      <p className="flex items-start gap-2.5 rounded-card border border-[var(--banner-temporary-line)] bg-[var(--banner-temporary-bg)] px-4 py-3 text-[12px] text-[var(--banner-temporary-text)]">
        <Icon className="mt-0.5 size-4 shrink-0" name="help" />
        {t("da.note", { district: districtName })}
      </p>

      {panel === "give" && (
        <Drawer subtitle={t("da.viewOnlyAll", { count: societyCount, district: districtName })} t={t} title={t("da.giveTitle")}>
          {deputies.length ? (
            <GiveAccessForm action={giveDistrictAccess} deputies={deputies} districtName={districtName} maxDays={list.maxDays} now={now} societyCount={societyCount} />
          ) : (
            <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">{t("da.noDdms", { district: districtName })}</p>
          )}
        </Drawer>
      )}
      {grantId && (
        <Drawer subtitle={detail ? t("rq.districtName", { name: detail.district.name }) : undefined} t={t} title={t("home.temporaryAccess")}>
          {detail ? (
            <GrantDetail
              endButton={
                detail.status === "ACTIVE" || detail.status === "SCHEDULED" ? (
                  <EndAccessButton action={endDistrictAccess} deputyName={detail.deputy.name} grantId={detail.id} returnTo="/district-access" />
                ) : undefined
              }
              grant={detail}
              now={now}
              t={t}
            />
          ) : (
            <p className="text-[12.5px] text-ink-soft">{t("da.notFound")}</p>
          )}
        </Drawer>
      )}
    </div>
  );
}
