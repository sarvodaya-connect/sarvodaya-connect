import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
      <section className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          Error 404
        </p>

        <h1 className="mt-3 text-3xl font-semibold text-zinc-950">
          Page not found
        </h1>

        <p className="mt-3 text-zinc-600">
          The requested dashboard page does not exist.
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}