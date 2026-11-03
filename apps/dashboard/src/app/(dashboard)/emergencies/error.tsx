"use client";

import { ErrorState } from "@/components/dashboard/data-states";

export default function DisasterResponseError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState description="Disaster response could not load. Check your connection and try again." onRetry={reset} />;
}
