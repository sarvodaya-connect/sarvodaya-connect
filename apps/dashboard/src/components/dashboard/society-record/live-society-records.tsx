import Link from "next/link";

import type { SocietySummary } from "@sarvodaya-connect/api-contracts";

import { platformApi } from "@/lib/platform-api";

/**
 * SC-65 entry point to the API-backed society records (D05). The national
 * directory and its filters (D04) are delivered separately; this list only
 * links HQ to each record. It stays hidden when the API cannot be reached.
 */
export async function LiveSocietyRecords() {
  let societies: SocietySummary[];
  try {
    societies = (await platformApi("/societies?page=1&pageSize=100")).data;
  } catch {
    return null;
  }
  if (societies.length === 0) return null;
  return (
    <section aria-labelledby="live-records-heading" className="mb-5 rounded-card border border-line bg-surface">
      <header className="border-b border-line-soft px-5 py-3">
        <h2 className="text-sm font-semibold text-ink" id="live-records-heading">Society records</h2>
        <p className="text-[11px] text-muted">Open a society to see its yearly summary, audit report, Exco, work plan and history.</p>
      </header>
      <ul className="divide-y divide-line-soft">
        {societies.map((society) => (
          <li className="flex items-center justify-between gap-3 px-5 py-2.5" key={society.id}>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-ink">{society.nameEn}</span>
              <span className="text-[10px] text-muted">
                {society.societyCode} · {society.district.nameEn}
              </span>
            </span>
            <Link
              className="shrink-0 rounded-md bg-brand-action px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-action-pressed"
              href={`/societies/${society.id}`}
            >
              Open record
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
