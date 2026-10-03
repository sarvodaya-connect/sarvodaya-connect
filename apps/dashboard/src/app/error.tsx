"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
      <section className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-950">
          Something went wrong
        </h1>

        <p className="mt-3 text-zinc-600">
          The dashboard could not complete this request. Please try again.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}