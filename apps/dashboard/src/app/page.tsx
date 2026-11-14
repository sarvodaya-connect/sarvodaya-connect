import Image from "next/image";

import { SignInForm } from "@/components/dashboard/identity-forms";
import { getT } from "@/i18n/server";

/** V5 D01 / D01e: dashboard sign-in. */
export default async function Home() {
  const t = await getT();
  return (
    <main className="grid min-h-screen grid-cols-1 bg-surface md:grid-cols-[48.7%_51.3%]">
      <aside className="relative isolate flex [container-type:inline-size] min-h-[320px] flex-col justify-end overflow-hidden bg-brand-forest p-7 text-white md:min-h-0 md:p-9">
        <Image
          alt=""
          className="-z-10 object-cover object-top"
          fill
          priority
          sizes="(min-width: 768px) 49vw, 100vw"
          src="/brand/sign-in-village.jpg"
        />
        {/* Dark green fade keeps the motto and footer readable over the illustration; on a phone the panel is short, so it starts higher. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(31,60,42,0.1)_0%,rgba(31,60,42,0.82)_40%,rgba(31,60,42,0.94)_100%)] md:bg-[linear-gradient(to_bottom,rgba(31,60,42,0)_38%,rgba(31,60,42,0.86)_66%,rgba(31,60,42,0.94)_100%)]"
        />
        {/*
          The official motto is always shown in all three languages, regardless of UI locale.
          D01: left-aligned, one line per language. Sizes use the panel's width (cqw), not the
          window's, so each line keeps fitting the panel instead of wrapping on smaller screens.
        */}
        <blockquote className="mb-10 w-full space-y-1 text-left font-normal leading-[1.6] text-[#f7f6ee] [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] md:mb-8">
          <p className="whitespace-nowrap text-[3.05cqw] [font-family:var(--font-noto-sinhala),sans-serif]" lang="si">
            මනුෂ්‍යත්වයේ උදාවක් ~ පරිවර්තනීය ප්‍රජාවක්
          </p>
          <p className="whitespace-nowrap text-[2.6cqw] [font-family:var(--font-noto-tamil),sans-serif]" lang="ta">
            மனித நேயத்தின் எழுச்சி ~ மாற்றம் பெறும் சமூகம்
          </p>
          <p className="whitespace-nowrap text-[3.4cqw] italic tracking-[-0.01em] [font-family:'Times_New_Roman',Times,'Liberation_Serif',serif]" lang="en">
            Awakening Humanity ~ Transforming Community
          </p>
        </blockquote>
        <p className="text-[11px] text-[#c4d6c8]">{t("signIn.heroFooter")}</p>
      </aside>
      <div className="relative flex items-center justify-center px-6 pb-10 pt-24 sm:px-10 md:py-10">
        <Image
          alt="Sarvodaya Connect"
          className="absolute right-6 top-6 h-12 w-auto sm:right-10 md:right-[78px] md:top-[54px] md:h-[58px]"
          height={180}
          priority
          src="/brand/sarvodaya-connect-wordmark.png"
          width={472}
        />
        <SignInForm />
      </div>
    </main>
  );
}
