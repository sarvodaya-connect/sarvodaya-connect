"use client";

import { useEffect } from "react";

import { Brand } from "@/components/dashboard/brand";
import { ErrorState } from "@/components/dashboard/data-states";
import { useI18n } from "@/i18n/provider";

export default function Error({
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f4f5ef] px-6 py-12">
      <Brand />
      <section className="mt-8 w-full max-w-lg rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <ErrorState description={t("err.connection")} onRetry={reset} reference={error.digest} referenceLabel={t("err.reference")} retryLabel={t("n.tryAgain")} title={t("err.title")} />
      </section>
    </main>
  );
}
