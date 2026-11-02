"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/dashboard/data-states";

export default function SpcError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
      <ErrorState
        description="The activities could not be loaded. Nothing has been approved or changed. Please try again."
        onRetry={retry}
        reference={error.digest}
        title="We couldn't load this page"
      />
    </section>
  );
}
