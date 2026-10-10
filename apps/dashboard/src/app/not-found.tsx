import Link from "next/link";

import { Brand } from "@/components/dashboard/brand";
import { EmptyState, primaryButtonClass } from "@/components/dashboard/data-states";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f4f5ef] px-6 py-12">
      <Brand />
      <section className="mt-8 w-full max-w-lg rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
        <EmptyState
          action={
            <Link className={primaryButtonClass} href="/societies">
              Go to societies
            </Link>
          }
          description="The page you requested does not exist or may have moved."
          icon="search"
          title="Page not found"
        />
      </section>
    </main>
  );
}
