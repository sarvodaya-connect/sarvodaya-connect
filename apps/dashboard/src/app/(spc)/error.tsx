"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/dashboard/data-states";
import { useI18n } from "@/i18n/provider";

export default function SpcError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <ErrorState
        description={t("err.activities")}
        onRetry={reset}
        reference={error.digest}
        referenceLabel={t("err.reference")}
        retryLabel={t("n.tryAgain")}
        title={t("err.title")}
      />
    </section>
  );
}
