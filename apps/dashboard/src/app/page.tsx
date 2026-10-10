import Link from "next/link";

import { Brand } from "@/components/dashboard/brand";

export default function Home() {

  return (
    <main className="grid min-h-screen bg-[#f7f7f3] lg:grid-cols-[42%_58%]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#123d29] px-14 py-12 text-white lg:flex lg:flex-col">
        <Brand inverse />
        <div className="my-auto max-w-lg pb-24">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#bdd5c2]">
            Sarvodaya Connect
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-0.045em]">
            One trusted record for every village society.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-[#dce9de]">
            Review society information, follow submissions and keep the
            national registry accurate.
          </p>
        </div>
        <div className="absolute -bottom-20 -left-16 h-52 w-[120%] rotate-[-3deg] rounded-[50%] bg-[#2e7c4d]" />
        <div className="absolute -bottom-32 -left-12 h-52 w-[115%] rotate-[2deg] rounded-[50%] bg-[#76a947]" />
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <p className="text-sm font-semibold text-[#26744b]">WELCOME BACK</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#17211b]">
            Sign in to the dashboard
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#68756c]">
            Your assigned role decides which dashboard and records you can
            access.
          </p>

          <div className="mt-8 space-y-5 rounded-2xl border border-[#dfe5dc] bg-white p-7 shadow-[0_18px_50px_rgba(20,48,31,0.08)]">
            <label className="block text-sm font-medium text-[#304038]">
              Username or email
              <input
                className="mt-2 w-full rounded-lg border border-[#ccd6ce] bg-white px-3.5 py-3 text-[#17211b] outline-none transition focus:border-[#26744b] focus:ring-3 focus:ring-[#dbeadd]"
                defaultValue="hq.admin@demo.sarvodaya.lk"
                type="email"
              />
            </label>
            <label className="block text-sm font-medium text-[#304038]">
              Password
              <input
                className="mt-2 w-full rounded-lg border border-[#ccd6ce] bg-white px-3.5 py-3 text-[#17211b] outline-none transition focus:border-[#26744b] focus:ring-3 focus:ring-[#dbeadd]"
                defaultValue="demonstration"
                type="password"
              />
            </label>
            <Link
              className="flex w-full items-center justify-center rounded-lg bg-[#1f6b43] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#174f34] focus:outline-none focus:ring-3 focus:ring-[#bbd7c0]"
              href="/societies"
            >
              Sign in
            </Link>
            <div className="flex items-start gap-3 rounded-lg bg-[#f1f6f0] p-3 text-xs leading-5 text-[#53645a]">
              <span aria-hidden="true" className="mt-0.5 text-base">◈</span>
              <p>
                Authentication is managed by WSO2 Identity Server. This
                prototype uses fictional demonstration credentials.
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-[#7b877f]">
            Authorised Sarvodaya personnel only · Demonstration Data
          </p>
        </div>
      </section>
    </main>
  );
}
