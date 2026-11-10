"use client";

import Link from "next/link";
import { useState } from "react";

import { useI18n } from "@/i18n/provider";

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
      <h3 className="text-[10.5px] font-bold tracking-[0.08em] text-muted">{label}</h3>
      <div className="flex flex-1 flex-col justify-center [&>div]:!px-2 [&>div]:!py-3 [&_[role=status][aria-busy]]:border-0 [&_[role=status][aria-busy]]:p-0">
        {children}
      </div>
    </section>
  );
}

/** V5 D21: how every page behaves when data is not normal. */
export function PageStatesGallery() {
  const { t } = useI18n();
  const [message, setMessage] = useState("");

  return (
    <>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-ink">{t("st.gallery.title")}</h2>
        <p className="mt-0.5 text-xs text-muted">{t("st.gallery.subtitle")}</p>
      </div>
      {message && (
        <p aria-live="polite" className="mb-3 rounded-button border border-[#d7e7d6] bg-brand-mint-soft px-4 py-3 text-xs text-brand-forest">
          {message}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StateCard label={t("st.gallery.loading")}>
          <TableSkeleton label={t("st.gallery.loadingPage")} t={t} />
        </StateCard>
        <StateCard label={t("st.gallery.empty")}>
          <EmptyState
            action={<Link className={secondaryButtonClass} href="/reviews">{t("sr.q.seeDecided")}</Link>}
            description={t("sr.q.emptyWaitingBody")}
            title={t("sr.q.emptyWaitingTitle")}
          />
        </StateCard>
        <StateCard label={t("st.gallery.noResults")}>
          <NoResultsState
            filters={[
              { id: "grade", label: t("st.gallery.grade"), value: "A" },
              { id: "division", label: t("st.gallery.ds"), value: "Wariyapola" },
            ]}
            itemLabel="societies"
            onClearAll={() => setMessage(t("st.gallery.cleared"))}
            onRemoveFilter={(id) => setMessage(t("st.gallery.removed", { filter: id === "grade" ? t("st.gallery.grade") : t("st.gallery.ds") }))}
            t={t}
            title={t("st.noResultsSocieties")}
          />
        </StateCard>
        <StateCard label={t("st.gallery.error")}>
          <ErrorState onRetry={() => setMessage(t("st.gallery.retry"))} t={t} />
        </StateCard>
        <StateCard label={t("st.gallery.success")}>
          <SuccessState
            action={<Link className={primaryButtonClass} href="/reviews">{t("sr.r.backToQueue")}</Link>}
            description={t("st.gallery.successBody")}
            title={t("st.gallery.successTitle")}
          />
        </StateCard>
        <StateCard label={t("st.gallery.noAccess")}>
          <NoAccessState t={t} />
        </StateCard>
      </div>
    </>
  );
}
