"use client";

import Link from "next/link";
import { useState } from "react";

import {
  EmptyState,
  ErrorState,
  NoAccessState,
  NoResultsState,
  SuccessState,
  TableSkeleton,
  primaryButtonClass,
  secondaryButtonClass,
} from "./data-states";

function StateCard({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <section className="flex min-h-[230px] flex-col rounded-card border border-line bg-surface p-4">
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{label}</h3>
      <div className="flex flex-1 flex-col justify-center [&>div]:!px-2 [&>div]:!py-3 [&_[role=status][aria-busy]]:border-0 [&_[role=status][aria-busy]]:p-0">
        {children}
      </div>
    </section>
  );
}

/** V5 D21: how every page behaves when data is not normal. */
export function PageStatesGallery() {
  const [message, setMessage] = useState("");

  return (
    <>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-ink">Page states</h2>
        <p className="mt-0.5 text-xs text-muted">How every page behaves when data is not normal</p>
      </div>
      {message && (
        <p aria-live="polite" className="mb-3 rounded-button border border-[#d7e7d6] bg-brand-mint-soft px-4 py-3 text-xs text-brand-forest">
          {message}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StateCard label="Loading">
          <TableSkeleton label="Loading page" />
        </StateCard>
        <StateCard label="Empty">
          <EmptyState
            action={<Link className={secondaryButtonClass} href="/reviews">See decided requests</Link>}
            description="New requests from Society Officers, SPCs and DDMs will appear here."
            title="No grade requests waiting"
          />
        </StateCard>
        <StateCard label="No results for these filters">
          <NoResultsState
            filters={[
              { id: "grade", label: "Grade", value: "A" },
              { id: "division", label: "DS division", value: "Wariyapola" },
            ]}
            itemLabel="societies"
            onClearAll={() => setMessage("All example filters have been cleared.")}
            onRemoveFilter={(id) => setMessage(`Removed the ${id} example filter.`)}
          />
        </StateCard>
        <StateCard label="Error · retry">
          <ErrorState onRetry={() => setMessage("Retry requested. This page shows examples only.")} />
        </StateCard>
        <StateCard label="Success">
          <SuccessState
            action={<Link className={primaryButtonClass} href="/reviews">Back to queue</Link>}
            description="The request has been decided and the people who asked have been told."
            title="Grade decision saved"
          />
        </StateCard>
        <StateCard label="No access">
          <NoAccessState />
        </StateCard>
      </div>
    </>
  );
}
