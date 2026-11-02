import Image from "next/image";

import { SignInForm } from "@/components/dashboard/identity-forms";

/** V5 D01 / D01e: dashboard sign-in. */
export default function Home() {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-surface md:grid-cols-[42%_58%]">
      <aside className="flex min-h-[240px] flex-col justify-between bg-brand-forest p-7 text-white md:min-h-0 md:p-9">
        <span className="w-fit rounded-xl bg-white px-4 py-2.5">
          <Image
            alt="Sarvodaya Connect"
            className="h-[52px] w-auto"
            height={180}
            priority
            src="/brand/sarvodaya-connect-wordmark.png"
            width={472}
          />
        </span>
        <div className="max-w-[460px] py-8 md:py-0">
          <p className="text-[28px] font-bold leading-tight md:text-[32px]">One trusted record for every village society.</p>
          <p className="mt-3 text-sm text-[#d6e2d9]">Desktop dashboard for HQ, District Managers, DDMs and SPCs.</p>
        </div>
        <p className="text-[11px] text-[#bdcec2]">Sarvodaya Shramadana Movement · Moratuwa, Sri Lanka</p>
      </aside>
      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <SignInForm />
      </div>
    </main>
  );
}
