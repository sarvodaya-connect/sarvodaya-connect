import Link from "next/link";

import { primaryButtonClass } from "@/components/dashboard/data-states";
import { Breadcrumb, PageTitle, SampleBadge, YearLinks, count, first, share } from "@/components/dashboard/national/parts";
import { SdgChips } from "@/components/dashboard/sdg/sdg-chip";
import { DataTable, Tbody, Td, Th, Thead, Tr } from "@/components/dashboard/ui/data-table";
import { DIMENSION_LABELS, approvedLabel, selectableStartYears } from "@/lib/activity-format";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getNationalProgrammes } from "@/lib/national-api";
import { isDemoMode } from "@/lib/platform-api";
import { sdgIconPath, sdgName } from "@/lib/sdg";
import { SARVODAYA_SECTORS } from "@/lib/v5-constants";

const DIMENSION_COLOURS = { SOCIAL: "#c0392b", ECONOMIC: "#2f5590", GOVERNANCE: "#7a3f96" } as const;

/** V5 D07 Programmes & activities (HQ only): done vs planned from SPC-approved activities. */
export default async function ProgrammesPage({ searchParams }: PageProps<"/activities">) {
  await getCurrentViewer();
  const params = await searchParams;
  const year = Number(first(params.year)) || undefined;
  const programmes = await getNationalProgrammes(year);
  const { financialYear } = programmes;
  const sectors = SARVODAYA_SECTORS.map((sector, index) => {
    const row = programmes.sectors.find((entry) => entry.sector === sector);
    return { number: index + 1, sector, planned: row?.planned ?? 0, completed: row?.completed ?? 0, societies: row?.societies ?? 0 };
  });
  const selected = programmes.recent.find((row) => row.id === first(params.activity)) ?? programmes.recent[0];
  const ranked = programmes.sdgs;

  return (
    <>
      <Breadcrumb current="Programmes & Activities" />
      <PageTitle
        actions={
          <>
            <YearLinks current={financialYear.startYear} href={(value) => `/activities?year=${value}`} years={selectableStartYears()} />
            <SampleBadge demo={isDemoMode()} label={`Demonstration data · ${financialYear.label}`} />
          </>
        }
        description={`${count(programmes.completed)} of ${count(programmes.planned)} planned activities done in ${financialYear.label} · only SPC-approved activities are counted`}
        title="Programmes & Activities"
      />

      <ul aria-label="Sarvodaya 10-Sector Approach" className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sectors.map((row) => (
          <li className="flex h-full flex-col rounded-card border border-line bg-surface p-3" key={row.sector}>
            <span className="flex items-start gap-2 text-[12px] font-bold text-ink">
              <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-brand-forest text-[10px] text-white">{row.number}</span>
              {row.sector}
            </span>
            <span className="mt-2 text-[12px] text-ink">
              <strong className="text-[20px]">{count(row.completed)}</strong> / {count(row.planned)} planned
            </span>
            <span className="mt-auto text-[10px] text-muted">{count(row.societies)} societies</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="sdg-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">UN Sustainable Development Goals</p>
        <h2 className="text-[15px] font-bold text-ink" id="sdg-heading">SDGs Ranked by Completed Activities</h2>
        <p className="text-[11px] text-muted">
          {financialYear.label} · ranked by completed, SPC-approved activities linked to each SDG. Equal counts are listed by SDG number. An activity can have several SDGs.
        </p>
        <ol className="mt-3 grid gap-x-8 md:grid-cols-2">
          {ranked.map((row, index) => (
            <li className="flex items-center gap-3 border-b border-line-soft py-2" key={row.sdg}>
              <span className="w-7 text-[11px] text-muted">{row.completed > 0 ? `#${index + 1}` : "—"}</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- static official icon */}
              <img alt="" className="size-10 rounded" src={sdgIconPath(row.sdg)} />
              <span className="flex-1 text-[12px] text-ink"><strong>SDG {row.sdg}</strong> · {sdgName(row.sdg)}</span>
              {row.completed > 0 ? (
                <span className="text-right"><strong className="block text-[15px] text-ink">{count(row.completed)}</strong><span className="text-[10px] text-muted">completed</span></span>
              ) : (
                <span className="text-[11px] text-muted">No data available</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="recent-heading" className="rounded-card border border-line bg-surface p-4">
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">Approved by SPCs</p>
          <h2 className="text-[15px] font-bold text-ink" id="recent-heading">Recent Activities · All Sectors</h2>
          {programmes.recent.length === 0 ? (
            <p className="mt-3 rounded-lg bg-[#f4f5f1] px-3 py-6 text-center text-[12px] text-muted">No activity has been approved yet.</p>
          ) : (
            <div className="mt-3">
              <DataTable>
                <Thead>
                  <tr>{["Activity", "Sector", "Society", "Approved", "UN SDGs"].map((heading) => <Th key={heading} scope="col">{heading}</Th>)}</tr>
                </Thead>
                <Tbody>
                  {programmes.recent.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <Link aria-current={row.id === selected?.id ? "true" : undefined} className="font-semibold text-ink underline-offset-2 hover:underline" href={`/activities?year=${financialYear.startYear}&activity=${row.id}`}>
                          {row.name}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">{row.sector || "—"}</Td>
                      <Td className="text-ink-soft">{row.society.name}</Td>
                      <Td className="text-ink-soft">{approvedLabel(row.approvedAt)}</Td>
                      <Td><SdgChips sdgs={row.sdgs} /></Td>
                    </Tr>
                  ))}
                </Tbody>
              </DataTable>
            </div>
          )}
        </section>
        <div className="flex flex-col gap-4">
          <section aria-labelledby="dimension-heading" className="rounded-card border border-line bg-surface p-4">
            <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">By Dimension</p>
            <h2 className="text-[15px] font-bold text-ink" id="dimension-heading">Social · Economic · Governance</h2>
            <ul className="mt-2 divide-y divide-line-soft text-[12px]">
              {programmes.byDimension.map((row) => (
                <li className="flex items-center justify-between py-2" key={row.dimension}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: DIMENSION_COLOURS[row.dimension] }} />
                    {DIMENSION_LABELS[row.dimension]}
                  </span>
                  <span><strong className="text-ink">{count(row.completed)}</strong> / {count(row.planned)} · {share(row.completed, row.planned)}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted">Each activity has one dimension, chosen by the Society Officer.</p>
          </section>
          {selected && (
            <section aria-labelledby="activity-detail" className="rounded-card border border-line bg-surface p-4">
              <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">Activity Detail</p>
              <h2 className="text-[15px] font-bold text-ink" id="activity-detail">{selected.name}</h2>
              <p className="text-[11px] text-muted">{selected.society.name}{selected.datesLabel ? ` · ${selected.datesLabel} ${selected.year}` : ` · ${selected.year}`}</p>
              <ul className="mt-3 grid auto-rows-fr grid-cols-2 gap-2">
                <li className="flex h-full flex-col rounded-tile bg-[#f6eff9] px-3 py-2"><span className="text-[10px] text-[#7a3f96]">Female / male</span><strong className="text-[16px] text-ink">{selected.femaleParticipants} / {selected.maleParticipants}</strong></li>
                <li className="flex h-full flex-col rounded-tile bg-[#eef6ef] px-3 py-2"><span className="text-[10px] text-brand-forest">Households benefited</span><strong className="text-[16px] text-ink">{count(selected.householdsBenefited)}</strong></li>
              </ul>
              <p className="mt-2 text-[11px] text-ink">{selected.sector || "No sector"} · {DIMENSION_LABELS[selected.dimension]}</p>
              <div className="mt-2"><SdgChips sdgs={selected.sdgs} /></div>
              <p className="mt-2 text-[11px] text-muted">
                {selected.createdBy ? `Created by ${selected.createdBy}. ` : ""}SDGs chosen and approved by {selected.approvedBy ?? "the SPC"} {approvedLabel(selected.approvedAt).toLowerCase()}.
              </p>
              <Link className={`${primaryButtonClass} mt-3 w-full justify-center`} href={`/societies/${selected.society.id}/work-plan`}>Open society work plan</Link>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
