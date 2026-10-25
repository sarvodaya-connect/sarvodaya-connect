import Image from "next/image";
import Link from "next/link";

export default function DashboardComingSoonPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-green-forest px-5 py-16 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="h-28 rounded-[50%_50%_0_0] bg-green-hill-700 md:h-40" />
        <div className="-mt-12 h-24 rounded-[50%_50%_0_0] bg-green-hill-400 md:-mt-16 md:h-36" />
        <div className="-mt-12 h-20 rounded-[50%_50%_0_0] bg-green-hill-200 md:-mt-16 md:h-28" />
      </div>

      <section className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-8 text-center text-ink shadow-2xl md:p-12">
        <Image
          alt="Sarvodaya Connect"
          className="mx-auto h-auto w-52"
          height={453}
          priority
          src="/brand/sarvodaya-connect-wordmark.png"
          width={1178}
        />
        <p className="mt-9 text-sm font-bold uppercase tracking-[0.18em] text-green-leaf">
          Staff dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Under development
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted">
          We’re preparing the secure dashboard for Sarvodaya staff. Please check
          back soon.
        </p>
        <Link
          className="mt-8 inline-flex items-center justify-center rounded-button bg-green-leaf px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-pine focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-green-hill-200"
          href="/"
        >
          Back to Sarvodaya Connect
        </Link>
      </section>
    </main>
  );
}
