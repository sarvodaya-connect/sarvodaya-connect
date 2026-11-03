import Link from "next/link";

import { MEMBERSHIP_LABELS } from "@/components/dashboard/national/membership-labels";
import { Breadcrumb, PageTitle, SampleBadge, Stat, count, share } from "@/components/dashboard/national/parts";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getNationalMembership } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";

/** "57% female · 43% male" as text: V5 shows no bars as data displays. */
function Split({ female, male }: { female: number; male: number }) {
  const total = female + male;
  if (total === 0) return <span className="text-muted">No members entered</span>;
  return (
    <span className="text-[11px]">
      <strong className="text-[#7a3f96]">{share(female, total)}%</strong> female · <strong className="text-[#2f5590]">{share(male, total)}%</strong> male
    </span>
  );
}

/** V5 D08 Membership (HQ only): counts only, no personal data. */
export default async function MembershipPage() {
  await getCurrentViewer();
  const membership = await getNationalMembership();
  const year = membership.year;

  return (
    <>
      <Breadcrumb current="Membership" />
      <PageTitle
        actions={<SampleBadge demo={isDemoMode()} label={`Demonstration data${year ? ` · ${year}` : ""}`} />}
        description={`Counts only — no personal data${year ? ` · latest counts, ${year}` : ""}`}
        title="Membership"
      />
      <ul className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <li><Stat label={`In ${count(membership.activeSocieties)} active societies`} value={count(membership.total)} /></li>
        <li><Stat label={`Female · ${share(membership.female, membership.total)}% of members`} tone="female" value={count(membership.female)} /></li>
        <li><Stat label={`Male · ${share(membership.male, membership.total)}% of members`} tone="male" value={count(membership.male)} /></li>
        <li><Stat label={`Societies reported · of ${count(membership.activeSocieties)}${year ? ` · ${year}` : ""}`} value={count(membership.societiesReported)} /></li>
      </ul>

      <section aria-labelledby="category-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">Breakdown</p>
        <h2 className="text-[15px] font-bold text-ink" id="category-heading">Membership by category</h2>
        <div className="mt-3">
          <DataTable>
            <Thead>
              <tr>{["Category", "Female / male", "Female", "Male", "Total"].map((heading) => <Th key={heading} scope="col">{heading}</Th>)}</tr>
            </Thead>
            <Tbody>
              {membership.categories.map((row) => (
                <Tr key={row.category}>
                  <Td className="font-semibold text-ink">{MEMBERSHIP_LABELS[row.category] ?? row.category}</Td>
                  <Td><Split female={row.female} male={row.male} /></Td>
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
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">By district</p>
        <h2 className="text-[15px] font-bold text-ink" id="district-heading">Members in each district</h2>
        <div className="mt-3">
          <DataTable>
            <Thead>
              <tr>{["District", "Active societies", "Members", "Female", "Male", "Female / male"].map((heading) => <Th key={heading} scope="col">{heading}</Th>)}</tr>
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
                  <Td><Split female={row.female} male={row.male} /></Td>
                </Tr>
              ))}
            </Tbody>
          </DataTable>
        </div>
        <p className="mt-2 text-[11px] text-muted">{membership.districts.length} districts · alphabetical. Members’ names are kept only in the signed members list, which only DMs and HQ can open.</p>
      </section>
    </>
  );
}
