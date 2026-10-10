"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { ErrorState, secondaryButtonClass } from "@/components/dashboard/data-states";

export default function DashboardError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
}) {
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
        description="The dashboard could not load this information. Your data has not been changed. Please try again, or return to the society registry."
        onRetry={retry}
        reference={error.digest}
        secondaryAction={
          <Link className={secondaryButtonClass} href="/societies" onClick={backToSocieties}>
            Back to societies
          </Link>
        }
        title="We couldn't load this page"
      />
    </section>
  );
}
