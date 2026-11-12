import Link from "next/link";

import type { MembershipCategoryTotal } from "@sarvodaya-connect/api-contracts";

import { Stat } from "@/components/dashboard/national/parts";
import { count, share } from "@/components/dashboard/national/format";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import type { MessageKey } from "@/i18n/messages/en";
import type { Translator } from "@/i18n/translate";

/** The D08 figures, shared by HQ's national view and the scoped views (issue #118). */
export interface MembershipFigures {
  year: number | null;
  activeSocieties: number;
  societiesReported: number;
  female: number;
  male: number;
  total: number;
  categories: MembershipCategoryTotal[];
  districts: { id: string; name: string; active: number; female: number; male: number; total: number }[];
}

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

export function MembershipStats({ membership, t }: { membership: MembershipFigures; t: Translator }) {
  const year = membership.year;
  return (
    <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <li><Stat label={t("mb.inActive", { count: count(membership.activeSocieties) })} value={count(membership.total)} /></li>
      <li><Stat label={t("n.femaleShare", { label: t("n.female"), percent: share(membership.female, membership.total) })} tone="female" value={count(membership.female)} /></li>
      <li><Stat label={t("n.femaleShare", { label: t("n.male"), percent: share(membership.male, membership.total) })} tone="male" value={count(membership.male)} /></li>
      <li><Stat label={year ? t("mb.reportedYear", { count: count(membership.activeSocieties), year }) : t("mb.reported", { count: count(membership.activeSocieties) })} value={count(membership.societiesReported)} /></li>
    </ul>
  );
}

export function CategoryTable({ membership, t }: { membership: MembershipFigures; t: Translator }) {
  return (
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
  );
}

/** Each district links to the list the viewer may open; `href` decides where. */
export function DistrictTable({ href, membership, t }: { href: (districtId: string) => string; membership: MembershipFigures; t: Translator }) {
  return (
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
                  <Link className="font-semibold text-ink underline-offset-2 hover:underline" href={href(row.id)}>{row.name}</Link>
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
  );
}
