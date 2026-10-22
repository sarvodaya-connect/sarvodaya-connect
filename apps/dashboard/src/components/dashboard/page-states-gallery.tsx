"use client";

import { useState } from "react";

import { EmptyState, ErrorState, NoPermissionState, NoResultsState, OfflineState } from "./data-states";

function StateCard({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <p className="border-b border-line-soft px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <div className="[&>div]:!py-5 [&>div]:min-h-[200px]">{children}</div>
    </section>
  );
}

export function PageStatesGallery() {
  const [message, setMessage] = useState("");

  return (
    <>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-[-0.015em] text-ink md:text-2xl">Page states</h2>
        <p className="mt-1 text-[13px] text-muted">
          How every page behaves when data isn&apos;t normal.
        </p>
      </div>
      {message && (
        <p
          aria-live="polite"
          className="mb-3 rounded-button border border-[#d7e7d6] bg-brand-mint-soft px-4 py-3 text-[12px] text-brand-forest"
        >
          {message}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StateCard label="Loading">
          <div aria-busy="true" aria-live="polite" className="space-y-2 p-4" role="status">
            <span className="sr-only">Loading dashboard data…</span>
            <div aria-hidden="true" className="flex items-center gap-3">
              <span className="size-9 animate-pulse rounded-full bg-[#eef1ec]" />
              <span className="h-4 w-1/2 animate-pulse rounded bg-[#eef1ec]" />
            </div>
            <div aria-hidden="true" className="h-3 w-full animate-pulse rounded bg-[#eef1ec]" />
            <div aria-hidden="true" className="h-3 w-4/5 animate-pulse rounded bg-[#eef1ec]" />
            <div aria-hidden="true" className="h-16 animate-pulse rounded bg-[#eef1ec]" />
          </div>
        </StateCard>
        <StateCard label="Empty">
          <EmptyState
            action={
              <button
                className="rounded-button border border-line px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
                onClick={() => setMessage("Returned to the district home preview.")}
                type="button"
              >
                Back to district home
              </button>
            }
            description="All submissions from your district have been dealt with. New ones will appear here."
            icon="inbox"
            title="Nothing to review"
          />
        </StateCard>
        <StateCard label="No results for these filters">
          <NoResultsState
            filters={[
              { id: "status", label: "Status", value: "Suspended" },
              { id: "district", label: "District", value: "Jaffna" },
              { id: "audit", label: "Audit", value: "Overdue" },
            ]}
            itemLabel="societies"
            onClearAll={() => setMessage("All preview filters have been cleared.")}
            onRemoveFilter={(id) => setMessage(`Removed the ${id} preview filter.`)}
          />
        </StateCard>
        <StateCard label="No permission">
          <NoPermissionState
            action={
              <button
                className="rounded-button border border-line px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
                onClick={() => setMessage("Your access request has been noted in this preview.")}
                type="button"
              >
                Request access
              </button>
            }
            description="You can see Kurunegala societies only. Ask HQ if you need access to Batticaloa records."
            title="This society is outside your district"
          />
        </StateCard>
        <StateCard label="Error">
          <ErrorState
            description="The connection to the server dropped. Nothing you entered was lost."
            onRetry={() => setMessage("Retry requested. This screen is using demonstration data.")}
            title="We couldn’t load this page"
          />
        </StateCard>
        <StateCard label="Offline (dashboard)">
          <OfflineState />
        </StateCard>
      </div>
    </>
  );
}
