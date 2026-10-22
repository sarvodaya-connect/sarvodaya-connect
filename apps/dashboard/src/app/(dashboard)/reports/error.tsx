'use client';

export default function ReportsError({ reset }: { error: Error; reset: () => void }) {
  return <section role="alert" className="rounded-2xl border border-red-200 bg-white p-8"><h2 className="text-xl font-semibold">Unable to load reports</h2><p className="mt-2 text-sm">Something went wrong while preparing the report catalogue.</p><button className="mt-4 rounded-lg bg-[#1f6b43] px-4 py-2 text-sm text-white" onClick={reset}>Try again</button></section>;
}
