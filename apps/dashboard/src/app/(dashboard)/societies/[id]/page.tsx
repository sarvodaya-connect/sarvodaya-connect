import { notFound } from "next/navigation";

import Link from "next/link";

import { Icon } from "@/components/dashboard/icon";
import { SocietyProfileTabs } from "@/components/dashboard/society-profile-tabs";
import { Pill } from "@/components/dashboard/ui/pill";
import { getMissingProfileInformation, societyDetails } from "@/lib/demo-registry";
import { demoSocietyAccess, societiesVisibleTo } from "@/lib/society-access";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { RecordOverviewPage } from "./record-overview-page";

export function generateStaticParams() {
  return societyDetails.map((society) => ({ id: society.id }));
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const statusTone = {
  ACTIVE: "on-time",
  UNDER_REVIEW: "under-review",
  INACTIVE: "inactive",
  SUSPENDED: "overdue",
} as const;

export default async function SocietyPage({ params, searchParams }: PageProps<"/societies/[id]">) {
  const { id } = await params;
  // SC-65: API-backed society records (D05). Demonstration profiles keep their readable ids.
  if (isSocietyRecordId(id)) {
    const { panel, saved } = await searchParams;
    return <RecordOverviewPage id={id} panel={typeof panel === "string" ? panel : undefined} saved={saved === "1"} />;
  }
  const society = societiesVisibleTo(societyDetails, demoSocietyAccess).find((item) => item.id === id);
  if (!society) notFound();
  const missingInformation = getMissingProfileInformation(society);
  const statusLabel = society.status.replaceAll("_", " ").toLowerCase();

  const president = society.committee.find((member) => member.position === "President");
  const shortName = society.nameEn.replace("Sarvodaya Shramadana Society", "SSS");
  const crumbs = [
    { href: "/dashboard", label: "National" },
    { href: `/districts/${society.district.nameEn.toLowerCase()}`, label: society.district.nameEn },
    { href: "/societies", label: "Societies" },
  ];

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
        {crumbs.map((crumb) => (
          <span className="flex items-center gap-1.5" key={crumb.label}>
            <Link className="text-[#2d5c88] underline underline-offset-2" href={crumb.href}>{crumb.label}</Link>
            <span aria-hidden="true">›</span>
          </span>
        ))}
        <span aria-current="page">{shortName}</span>
      </nav>

      <section className="mb-5 mt-3 rounded-card border border-line bg-surface px-5 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-mint text-brand-forest">
              <Icon className="size-5" name="society" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] font-bold tracking-[-0.015em] text-ink">{shortName}</h2>
                <Pill tone={statusTone[society.status as keyof typeof statusTone] ?? "inactive"}>
                  <span className="capitalize">{statusLabel}</span>
                </Pill>
                <Pill tone="inactive">Class A · Strong</Pill>
              </div>
              {society.nameLocal && <p className="mt-0.5 text-[13px] text-ink-soft">{society.nameLocal}</p>}
              <p className="mt-1 text-[11px] text-muted">
                {society.societyCode} · {society.district.nameEn}
                {society.address.dsDivision && ` · ${society.address.dsDivision} DS`}
                {society.address.gnDivision && ` · ${society.address.gnDivision} GN`}
                {` · Last verified ${dateFormatter.format(new Date(society.updatedAt))}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
              type="button"
            >
              View on map
            </button>
            <button
              className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
              type="button"
            >
              Export profile
            </button>
            <button
              className="rounded-button bg-brand-action px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed"
              type="button"
            >
              Send a request
            </button>
          </div>
        </div>
      </section>

      {missingInformation.length > 0 && (
        <section aria-label="Missing profile information" className="mb-5 rounded-card border border-[#ead9a7] bg-warn-bg px-5 py-4">
          <h2 className="text-sm font-semibold text-warn-text">Important information missing</h2>
          <p className="mt-1 text-xs text-warn-text">Complete these profile fields to improve the registry record.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {missingInformation.map((item) => (
              <li
                className="rounded-pill border border-[#e7d69f] bg-white/70 px-3 py-1 text-xs text-warn-text"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SocietyProfileTabs missingCount={missingInformation.length} president={president?.fullName} society={society} />
    </>
  );
}
