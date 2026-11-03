import Link from "next/link";

import { GiveAccessForm, EndAccessButton } from "@/components/dashboard/district-access/access-controls";
import { CurrentGrant, DmAccessBanner, Drawer, GrantDetail, GrantHistoryTable, GrantStatus } from "@/components/dashboard/district-access/district-access-view";
import { NoAccessState } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
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
  if (viewer.role !== "DISTRICT_MANAGER") {
    return (
      <NoAccessState
        action={<Link className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" href="/dashboard">Go to my home</Link>}
        description="Only the District Manager gives temporary district access."
        heading="h1"
        title="This page is for District Managers"
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
  const districtName = home.district?.name ?? "your district";
  const societyCount = home.societies.total;
  const current = list.data.filter((g) => g.status === "ACTIVE" || g.status === "SCHEDULED");
  const given = first(params.given);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Temporary DDM access</h1>
          <p className="text-[12.5px] text-ink-soft">Let a DDM view all {districtName} societies while you are away</p>
        </div>
        <Link className="inline-flex h-[38px] items-center gap-1.5 rounded-button bg-brand-action px-4 text-[13px] font-semibold text-white hover:bg-brand-action-pressed" href="/district-access?panel=give">
          <Icon className="size-4" name="key" strokeWidth={2} />
          Give temporary access
        </Link>
      </div>

      <DmAccessBanner districtName={districtName} societyCount={societyCount} />
      {given && (
        <p className="rounded-card border border-[#c6e2cd] bg-success-bg px-4 py-2.5 text-[12px] font-semibold text-success-text" role="status">
          Temporary view-only access given. The DDM sees it the next time they open Sarvodaya Connect.
        </p>
      )}
      {first(params.ended) && (
        <p className="rounded-card border border-[#c6e2cd] bg-success-bg px-4 py-2.5 text-[12px] font-semibold text-success-text" role="status">
          Access ended. The DDM no longer sees the district.
        </p>
      )}
      {first(params.endFailed) && (
        <p className="rounded-card border border-[#efc4bd] bg-danger-bg px-4 py-2.5 text-[12px] font-semibold text-danger-text" role="alert">
          The access could not be ended. It may have ended already. Refresh and try again.
        </p>
      )}

      <section aria-labelledby="current-heading" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">Active now</p>
            <h2 className="text-[15px] font-bold text-ink" id="current-heading">{current.length > 1 ? "Current grants" : "Current grant"}</h2>
          </div>
          {current[0] && <GrantStatus grant={current[0]} />}
        </div>
        {current.length ? (
          current.map((grant) => (
            <CurrentGrant
              endButton={<EndAccessButton action={endDistrictAccess} deputyName={grant.deputy.name} grantId={grant.id} returnTo="/district-access" />}
              grant={grant}
              key={grant.id}
              now={now}
            />
          ))
        ) : (
          <p className="text-[12.5px] text-ink-soft">No DDM has temporary access now.</p>
        )}
      </section>

      <section aria-labelledby="history-table-heading" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">History</p>
          <h2 className="text-[15px] font-bold text-ink" id="history-table-heading">Grants you have given</h2>
        </div>
        <GrantHistoryTable grants={list.data} />
      </section>

      <p className="flex items-start gap-2.5 rounded-card border border-[var(--banner-temporary-line)] bg-[var(--banner-temporary-bg)] px-4 py-3 text-[12px] text-[var(--banner-temporary-text)]">
        <Icon className="mt-0.5 size-4 shrink-0" name="help" />
        Only DDMs in {districtName} can be chosen. Access is always view only, has a start and end time, ends on its own and can be ended early. HQ sees every grant in the
        Change &amp; access log.
      </p>

      {panel === "give" && (
        <Drawer subtitle={`View only · all ${societyCount} ${districtName} societies`} title="Give temporary access">
          {deputies.length ? (
            <GiveAccessForm action={giveDistrictAccess} deputies={deputies} districtName={districtName} maxDays={list.maxDays} now={now} societyCount={societyCount} />
          ) : (
            <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">There are no active DDM accounts in {districtName} yet. Ask HQ to create one.</p>
          )}
        </Drawer>
      )}
      {grantId && (
        <Drawer subtitle={detail ? `${detail.district.name} District` : undefined} title="Temporary access">
          {detail ? (
            <GrantDetail
              endButton={
                detail.status === "ACTIVE" || detail.status === "SCHEDULED" ? (
                  <EndAccessButton action={endDistrictAccess} deputyName={detail.deputy.name} grantId={detail.id} returnTo="/district-access" />
                ) : undefined
              }
              grant={detail}
              now={now}
            />
          ) : (
            <p className="text-[12.5px] text-ink-soft">This grant could not be found. It may belong to another district.</p>
          )}
        </Drawer>
      )}
    </div>
  );
}
