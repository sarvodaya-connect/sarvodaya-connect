"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ReviewQueueItem } from "@/lib/demo-registry";

import { Icon } from "./icon";
import { StatusPill } from "./status-pill";

export function ReviewQueue({ items }: { items: ReviewQueueItem[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const filtered = useMemo(() => items.filter((item) => {
    const normalized = query.toLowerCase();
    return (type === "all" || item.type === type) && (!normalized || item.societyName.toLowerCase().includes(normalized) || item.reference.toLowerCase().includes(normalized));
  }), [items, query, type]);

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <div className="grid gap-3 border-b border-[#e4e8e2] p-4 md:grid-cols-[1fr_220px]">
        <label className="relative"><span className="sr-only">Search submissions</span><Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78857d]" name="search" /><input className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#39815a]" onChange={(event) => setQuery(event.target.value)} placeholder="Search society or submission reference" value={query} /></label>
        <select aria-label="Submission type" className="rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-3 py-2.5 text-sm text-[#3e4b43] outline-none" onChange={(event) => setType(event.target.value)} value={type}><option value="all">All submission types</option><option value="Committee update">Committee update</option><option value="Activity report">Activity report</option></select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left"><thead className="bg-[#f7f8f5] text-[10px] uppercase tracking-[0.1em] text-[#738078]"><tr><th className="px-5 py-3">Society</th><th className="px-5 py-3">Submission</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Waiting</th><th className="px-5 py-3"><span className="sr-only">Action</span></th></tr></thead>
          <tbody className="divide-y divide-[#edf0eb]">{filtered.map((item) => <tr className="hover:bg-[#f8faf6]" key={item.id}><td className="px-5 py-4"><strong className="block text-sm text-[#26362c]">{item.societyName}</strong><span className="mt-1 block text-xs text-[#748078]">{item.societyCode}</span></td><td className="px-5 py-4"><span className="block text-sm text-[#4f5d54]">{item.type}</span><span className="mt-1 block text-xs text-[#7c887f]">{item.reference}</span></td><td className="px-5 py-4 text-xs text-[#617067]">{item.submittedAt}</td><td className="px-5 py-4"><StatusPill value={item.status} /></td><td className="px-5 py-4 text-xs font-medium text-[#6c5b20]">{item.waitingLabel}</td><td className="px-5 py-4 text-right"><Link className="inline-flex rounded-md bg-[#1f6b43] px-3 py-2 text-xs font-semibold text-white hover:bg-[#174f34]" href={`/societies/${item.societyId}`}>Review</Link></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
