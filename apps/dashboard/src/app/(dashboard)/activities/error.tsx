"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ErrorState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { useI18n } from "@/i18n/provider";

/**
 * D07 could not load. This says the figures are unavailable, so it is never
 * mistaken for a year with no activities (which shows zeros instead).
 */
export default function ProgrammesError({ error, retry }: { error: Error & { digest?: string }; reset: () => void; retry: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <ErrorState
        description={t("prog.errorBody")}
        onRetry={retry}
        reference={error.digest}
        referenceLabel={t("err.reference")}
        retryLabel={t("n.tryAgain")}
        secondaryAction={<Link className={secondaryButtonClass} href="/dashboard">{t("nav.home")}</Link>}
        title={t("prog.errorTitle")}
      />
    </section>
  );
}
