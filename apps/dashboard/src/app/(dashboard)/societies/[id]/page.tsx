import { notFound } from "next/navigation";

import { PageHeading } from "@/components/dashboard/page-heading";
import { SocietyProfileTabs } from "@/components/dashboard/society-profile-tabs";
import { ChangedInV2Badge } from "@/components/dashboard/ui/changed-in-v2-badge";
import { Pill } from "@/components/dashboard/ui/pill";
import { getMissingProfileInformation, societyDetails } from "@/lib/demo-registry";
import { demoSocietyAccess, societiesVisibleTo } from "@/lib/society-access";

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

export default async function SocietyPage({ params }: PageProps<"/societies/[id]">) {
  const { id } = await params;
  const society = societiesVisibleTo(societyDetails, demoSocietyAccess).find((item) => item.id === id);
  if (!society) notFound();
  const missingInformation = getMissingProfileInformation(society);
  const statusLabel = society.status.replaceAll("_", " ").toLowerCase();

  return (
    <>
      <PageHeading
        breadcrumbs={[
          { href: "/societies", label: "Societies" },
          { href: `/districts/${society.district.nameEn.toLowerCase()}`, label: society.district.nameEn },
          { label: society.societyCode },
        ]}
        title="Society profile"
      />

      <section className="my-6 rounded-card border border-line bg-surface">
        <div className="flex flex-col gap-5 border-b border-line-soft px-6 py-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink">{society.nameEn}</h2>
              <Pill tone={statusTone[society.status as keyof typeof statusTone] ?? "inactive"}>
                <span className="capitalize">{statusLabel}</span>
              </Pill>
              <ChangedInV2Badge />
            </div>
            {society.nameLocal && <p className="mt-1 text-[13px] text-ink-soft">{society.nameLocal}</p>}
            <p className="mt-1 text-[12px] text-muted">
              {society.societyCode} · {society.district.nameEn} District
              {society.address.dsDivision && ` · ${society.address.dsDivision}`}
            </p>
            <p className="mt-2 text-[11px] text-muted">
              ✓ Last verified {dateFormatter.format(new Date(society.updatedAt))} · Latest approved change: committee update
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
              type="button"
            >
              Open map
            </button>
            <button
              className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
              type="button"
            >
              Open latest audit
            </button>
            <button
              className="rounded-button bg-brand-action px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed"
              type="button"
            >
              Request update
            </button>
          </div>
        </div>

        <dl className="grid gap-0 divide-y divide-line-soft sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <HeroStat label="Members" value={society.membership?.overallTotal?.toLocaleString("en-GB") ?? "—"} note="Across all categories" />
          <HeroStat label="Wealth" value="LKR 2.5M" note="31 Mar 2026" />
          <HeroStat label="SDF shares" value="LKR 640,000" note="320 shares" />
          <HeroStat
            label="Profile complete"
            value={`${society.profileCompleteness}%`}
            note={missingInformation.length === 0 ? "Registry ready" : `${missingInformation.length} items to complete`}
          />
        </dl>
      </section>

      {missingInformation.length > 0 && (
        <section aria-label="Missing profile information" className="mb-6 rounded-card border border-[#ead9a7] bg-warn-bg px-5 py-4">
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

      <SocietyProfileTabs society={society} />
    </>
  );
}

function HeroStat({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <div className="px-6 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 text-[22px] font-bold tracking-[-0.015em] text-ink md:text-[26px]">{value}</dd>
      {note && <p className="mt-0.5 text-[11px] text-muted">{note}</p>}
    </div>
  );
}
