"use client";

import { useState } from "react";

import { ConflictState, EmptyState, ErrorState, NoPermissionState, NoResultsState, OfflineState } from "./data-states";

function StateCard({ children, label }: { children: React.ReactNode; label: string }) {
  return <section className="overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-sm"><p className="border-b border-[#edf0eb] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#69756d]">{label}</p><div className="[&>div]:!py-5 [&>div]:min-h-[190px]">{children}</div></section>;
}

export function PageStatesGallery() {
  const [message, setMessage] = useState("");

  return <>
    <div className="mb-4"><h2 className="text-xl font-semibold tracking-[-0.03em] text-[#203329]">Page states</h2><p className="mt-1 text-sm text-[#68756c]">How dashboard pages behave when data isn&apos;t normal.</p></div>
    {message && <p aria-live="polite" className="mb-3 rounded-lg border border-[#d7e7d6] bg-[#f1f7ef] px-4 py-3 text-xs text-[#355b3e]">{message}</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <StateCard label="Loading"><div aria-busy="true" aria-live="polite" className="space-y-2 p-4" role="status"><span className="sr-only">Loading dashboard data…</span><div aria-hidden="true" className="flex items-center gap-3"><span className="size-9 animate-pulse rounded-full bg-[#eef1ec]"/><span className="h-4 w-1/2 animate-pulse rounded bg-[#eef1ec]"/></div><div aria-hidden="true" className="h-3 w-full animate-pulse rounded bg-[#eef1ec]"/><div aria-hidden="true" className="h-3 w-4/5 animate-pulse rounded bg-[#eef1ec]"/><div aria-hidden="true" className="h-16 animate-pulse rounded bg-[#eef1ec]"/></div></StateCard>
      <StateCard label="Empty"><EmptyState action={<button className="rounded-lg border border-[#ccd6ce] px-3 py-2 text-xs font-medium text-[#344239]" onClick={() => setMessage("Returned to the district home preview.")} type="button">Back to district home</button>} description="All submissions from your district have been dealt with. New ones will appear here." icon="inbox" title="Nothing to review"/></StateCard>
      <StateCard label="No results for these filters"><NoResultsState filters={[{ id: "status", label: "Status", value: "Suspended" }, { id: "district", label: "District", value: "Jaffna" }, { id: "audit", label: "Audit", value: "Overdue" }]} itemLabel="societies" onClearAll={() => setMessage("All preview filters have been cleared.")} onRemoveFilter={(id) => setMessage(`Removed the ${id} preview filter.`)}/></StateCard>
      <StateCard label="No permission"><NoPermissionState action={<button className="rounded-lg border border-[#ccd6ce] px-3 py-2 text-xs font-medium text-[#344239]" onClick={() => setMessage("Your access request has been noted in this preview.")} type="button">Request access</button>} description="You can see Kurunegala societies only. Ask HQ if you need access to Batticaloa records." title="This society is outside your district"/></StateCard>
      <StateCard label="Error"><ErrorState description="The connection to the server dropped. Nothing you entered was lost." onRetry={() => setMessage("Retry requested. This screen is using demonstration data.")} title="We couldn’t load this page"/></StateCard>
      <StateCard label="Offline (dashboard)"><OfflineState/></StateCard>
      <StateCard label="Conflicting update · MVP"><ConflictState onReload={() => setMessage("Latest record version requested. Unsaved changes were not submitted.")}/></StateCard>
    </div>
  </>;
}
