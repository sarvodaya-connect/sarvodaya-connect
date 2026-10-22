import Link from "next/link";

import { Brand } from "@/components/dashboard/brand";
import { Icon } from "@/components/dashboard/icon";

import { signInAs } from "./(dashboard)/actions";

/**
 * Catalogue D01 — Dashboard sign-in.
 * Split layout: forest panel with the brand promise on the left, white sign-in
 * card on the right with a language toggle, the Sarvodaya account button, and
 * a prototype role-picker that drops the demo viewer into the right home.
 */
export default function Home() {
  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[44%_56%]">
      <section className="relative hidden min-h-screen overflow-hidden bg-brand-forest px-12 py-10 text-white lg:flex lg:flex-col">
        <Brand compact inverse />
        <div className="my-auto max-w-md pr-8">
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.03em] text-white">
            One verified record for every village society.
          </h1>
          <p className="mt-5 text-[15px] leading-7 text-[#c9ddcd]">
            For District Centres, Coordinators and Headquarters staff of the
            Sarvodaya Shramadana Movement.
          </p>
        </div>
        <p className="text-xs text-[#8db39a]">
          Sarvodaya Shramadana Movement · Moratuwa, Sri Lanka
        </p>
      </section>

      <section className="relative flex min-h-screen flex-col px-6 py-8 md:px-12 md:py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="lg:hidden">
            <Brand compact />
          </div>
          <LanguagePicker />
        </div>

        <div className="mx-auto my-auto w-full max-w-[420px] pt-6">
          <h2 className="text-[26px] font-bold tracking-[-0.025em] text-ink">
            Sign in
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use your Sarvodaya account. You will be asked for your verification code.
          </p>

          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-button bg-brand-action px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-action-pressed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]"
            type="button"
          >
            <Icon className="size-4" name="lock" />
            Sign in with Sarvodaya account
          </button>

          <div className="mt-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Prototype · Continue as
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="mt-5 space-y-2.5">
            {rolePickerOptions.map((option) => (
              <RolePickerButton key={option.label} {...option} />
            ))}
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-button border border-[#c8d9ea] bg-info-bg px-3.5 py-3 text-[12px] leading-5 text-info-text">
            <Icon className="mt-0.5 size-4 shrink-0" name="shield" />
            <p>Two-step verification is required for all dashboard users.</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-ink-soft">
            <Link className="underline-offset-4 hover:underline" href="#">
              Trouble signing in?
            </Link>
            <Link className="underline-offset-4 hover:underline" href="#">
              Privacy notice
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

type RoleOption = { label: string; viewerId: string };

/**
 * Role list from the catalogue (D01). Emergency Response is listed for visual
 * parity even though it isn't a distinct demo viewer yet — it drops into the
 * HQ Administrator home so the preview still works.
 */
const rolePickerOptions: RoleOption[] = [
  { label: "HQ Officer / Analyst", viewerId: "hq-admin" },
  { label: "District Manager", viewerId: "district-manager" },
  { label: "Programme Coordinator", viewerId: "programme-coordinator" },
  { label: "Emergency Response", viewerId: "hq-admin" },
  { label: "HQ / System Admin", viewerId: "system-admin" },
];

function RolePickerButton({ label, viewerId }: RoleOption) {
  return (
    <form action={signInAs}>
      <input name="viewer" type="hidden" value={viewerId} />
      <button
        className="group flex w-full items-center justify-between rounded-button border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-leaf hover:bg-brand-mint-soft hover:text-brand-forest focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd]"
        type="submit"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-muted transition group-hover:text-brand-leaf">
          →
        </span>
      </button>
    </form>
  );
}

const languages = [
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
  { code: "en", label: "English" },
];

function LanguagePicker() {
  return (
    <div
      aria-label="Interface language"
      className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface p-1"
      role="group"
    >
      {languages.map((lang) => (
        <button
          aria-pressed={lang.code === "en"}
          className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
            lang.code === "en"
              ? "bg-brand-forest text-white"
              : "text-ink-soft hover:text-brand-forest"
          }`}
          key={lang.code}
          type="button"
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
