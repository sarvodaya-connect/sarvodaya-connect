import Link from "next/link";

import { Breadcrumb, PageTitle, SampleBadge, Stat } from "@/components/dashboard/national/parts";
import { count, share } from "@/components/dashboard/national/format";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages/en";
import type { Translator } from "@/i18n/translate";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getNationalMembership } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

/** "57% female · 43% male" as text: V5 shows no bars as data displays. */
function Split({ female, male, t }: { female: number; male: number; t: Translator }) {
  const total = female + male;
  if (total === 0) return <span className="text-muted">{t("mb.noMembers")}</span>;
  return (
    <span className="text-[11px]">
      {t.rich("mb.split", { female: <strong className="text-[#7a3f96]">{share(female, total)}%</strong>, male: <strong className="text-[#2f5590]">{share(male, total)}%</strong> })}
    </span>
  );
}

/** V5 D08 Membership (HQ only): counts only, no personal data. */
export default async function MembershipPage() {
  await getCurrentViewer();
  const t = await getT();
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
      <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <li><Stat label={t("mb.inActive", { count: count(membership.activeSocieties) })} value={count(membership.total)} /></li>
        <li><Stat label={t("n.femaleShare", { label: t("n.female"), percent: share(membership.female, membership.total) })} tone="female" value={count(membership.female)} /></li>
        <li><Stat label={t("n.femaleShare", { label: t("n.male"), percent: share(membership.male, membership.total) })} tone="male" value={count(membership.male)} /></li>
        <li><Stat label={year ? t("mb.reportedYear", { count: count(membership.activeSocieties), year }) : t("mb.reported", { count: count(membership.activeSocieties) })} value={count(membership.societiesReported)} /></li>
      </ul>

      <section aria-labelledby="category-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("mb.breakdown")}</p>
        <h2 className="text-[15px] font-bold text-ink" id="category-heading">{t("mb.byCategory")}</h2>
        <div className="mt-3">
          <DataTable>
            <Thead>
              <tr>{[t("n.category"), t("mb.femaleMale"), t("n.female"), t("n.male"), t("n.total")].map((heading) => <Th key={heading} scope="col">{heading}</Th>)}</tr>
            </Thead>
            <Tbody>
              {membership.categories.map((row) => (
                <Tr key={row.category}>
                  <Td className="font-semibold text-ink">{t(`member.${row.category}` as MessageKey)}</Td>
                  <Td><Split female={row.female} male={row.male} t={t} /></Td>
                  <Td className="text-[#7a3f96]">{count(row.female)}</Td>
                  <Td className="text-[#2f5590]">{count(row.male)}</Td>
                  <Td className="font-semibold text-ink">{count(row.total)}</Td>
                </Tr>
              ))}
            </Tbody>
          </DataTable>
        </div>
      </section>

      <section aria-labelledby="district-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">{t("mb.byDistrict")}</p>
        <h2 className="text-[15px] font-bold text-ink" id="district-heading">{t("mb.inEachDistrict")}</h2>
        <div className="mt-3">
          <DataTable>
            <Thead>
              <tr>{[t("mb.district"), t("d.activeSocieties"), t("nav.membersShort"), t("n.female"), t("n.male"), t("mb.femaleMale")].map((heading) => <Th key={heading} scope="col">{heading}</Th>)}</tr>
            </Thead>
            <Tbody>
              {membership.districts.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link className="font-semibold text-ink underline-offset-2 hover:underline" href={`/societies?districtId=${row.id}`}>{row.name}</Link>
                  </Td>
                  <Td className="text-ink-soft">{count(row.active)}</Td>
                  <Td className="font-semibold text-ink">{count(row.total)}</Td>
                  <Td className="text-[#7a3f96]">{count(row.female)}</Td>
                  <Td className="text-[#2f5590]">{count(row.male)}</Td>
                  <Td><Split female={row.female} male={row.male} t={t} /></Td>
                </Tr>
              ))}
            </Tbody>
          </DataTable>
        </div>
        <p className="mt-2 text-[11px] text-muted">{t("mb.footer", { count: membership.districts.length })}</p>
      </section>
    </>
  );
}
