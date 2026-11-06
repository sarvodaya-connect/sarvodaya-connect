"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { ErrorState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { useI18n } from "@/i18n/provider";

export default function DashboardError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  function backToSocieties(event: React.MouseEvent<HTMLAnchorElement>) {
    // The error boundary only resets itself when the pathname changes. Clearing
    // it in the same transition as the navigation also recovers when the error
    // happened on /societies itself (for example /societies?demo=error).
    event.preventDefault();
    startTransition(() => {
      router.push("/societies");
      reset();
    });
  }

  return (
    <section className="rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <ErrorState
        description={t("err.dashboard")}
        onRetry={retry}
        reference={error.digest}
        referenceLabel={t("err.reference")}
        retryLabel={t("n.tryAgain")}
        secondaryAction={
          <Link className={secondaryButtonClass} href="/societies" onClick={backToSocieties}>
            {t("err.back")}
          </Link>
        }
        title={t("err.title")}
      />
    </section>
  );
}
