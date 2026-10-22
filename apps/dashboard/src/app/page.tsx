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
    <main className="grid min-h-screen bg-surface lg:grid-cols-[47%_53%]">
      <section className="relative hidden min-h-screen overflow-hidden bg-brand-forest px-12 py-10 text-white lg:flex lg:flex-col">
        <Brand compact inverse />
        <div className="my-auto max-w-md pr-8">
          <h1 className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] text-white">
            One verified record for every village society.
          </h1>
          <p className="mt-4 text-[14px] leading-6 text-[#e3eee5]">
            For District Centres, Coordinators and Headquarters staff of the
            Sarvodaya Shramadana Movement.
          </p>
        </div>
        <p className="text-xs text-[#8db39a]">
          Sarvodaya Shramadana Movement · Moratuwa, Sri Lanka
        </p>
      </section>

      <section className="relative flex min-h-screen flex-col px-6 py-8 md:px-12 md:py-10">
        <div className="lg:hidden">
          <Brand compact />
        </div>

        <div className="mx-auto my-auto w-full max-w-[380px] pt-6">
          <div className="mb-6 flex justify-end">
            <LanguagePicker />
          </div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-ink">
            Sign in
          </h2>
          <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">
            Use your Sarvodaya account. You will be asked for your verification code.
          </p>

          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-button bg-brand-action px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-action-pressed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#bbd7c0]"
            type="button"
          >
            <Icon className="size-4" name="lock" />
            Sign in with Sarvodaya account
          </button>

          <div className="mt-7 border-t border-line pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Prototype · Continue as
            </span>
          </div>

          <div className="mt-2.5 space-y-2">
            {rolePickerOptions.map((option) => (
              <RolePickerButton key={option.label} {...option} />
            ))}
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-button border border-[#2d5c88] bg-info-bg px-3.5 py-3 text-[12px] leading-5 text-ink">
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-[#2d5c88] text-[10px] font-bold text-[#2d5c88]"
            >
              i
            </span>
            <p>Two-step verification is required for all dashboard users.</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#2d5c88]">
            <Link className="underline underline-offset-2" href="#">
              Trouble signing in?
            </Link>
            <Link className="underline underline-offset-2" href="#">
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
        className="group flex w-full items-center justify-between rounded-button border border-line bg-surface px-3.5 py-2.5 text-[13px] font-medium text-ink transition hover:border-brand-leaf hover:bg-brand-mint-soft hover:text-brand-forest focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd]"
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
      className="inline-flex items-center overflow-hidden rounded-button border border-line bg-surface"
      role="group"
    >
      {languages.map((lang) => (
        <button
          aria-pressed={lang.code === "en"}
          className={`border-l border-line px-3 py-1.5 text-xs transition first:border-l-0 ${
            lang.code === "en"
              ? "bg-brand-mint font-semibold text-brand-forest"
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
