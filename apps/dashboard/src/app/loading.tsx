import { Brand } from "@/components/dashboard/brand";

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f4f5ef] px-6">
      <Brand />
      <div aria-live="polite" className="flex items-center gap-3" role="status">
        <span
          aria-hidden="true"
          className="size-5 rounded-full border-2 border-[#cfe0d1] border-t-[#26744b] motion-safe:animate-spin"
        />
        <p className="text-sm font-medium text-[#3e4b43]">Loading Sarvodaya Connect…</p>
      </div>
    </main>
  );
}
