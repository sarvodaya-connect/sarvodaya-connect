import Image from "next/image";

import { SignInForm } from "@/components/dashboard/identity-forms";
import { getT } from "@/i18n/server";

/** V5 D01 / D01e: dashboard sign-in. */
export default async function Home() {
  const t = await getT();
  return (
    <main className="grid min-h-screen grid-cols-1 bg-surface md:grid-cols-[48.7%_51.3%]">
      <aside className="relative isolate flex min-h-[320px] flex-col justify-end overflow-hidden bg-brand-forest p-7 text-white md:min-h-0 md:p-9">
        <Image
          alt=""
          className="-z-10 object-cover object-top"
          fill
          priority
          sizes="(min-width: 768px) 49vw, 100vw"
          src="/brand/sign-in-village.jpg"
        />
        {/* Dark green fade keeps the motto and footer readable over the illustration. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(31,60,42,0)_38%,rgba(31,60,42,0.86)_66%,rgba(31,60,42,0.94)_100%)]"
        />
        {/* The official motto is always shown in all three languages, regardless of UI locale. */}
        <blockquote className="mx-auto mb-10 w-full max-w-[42rem] space-y-3 text-center font-normal leading-[1.65] text-[#f7f6ee] [text-shadow:0_1px_3px_rgba(0,0,0,0.35)] md:mb-[clamp(3rem,9vh,6rem)]">
          <p className="text-[18px] [font-family:var(--font-noto-sinhala),sans-serif] md:text-[clamp(0.9375rem,1.8vw,1.875rem)]" lang="si">
            මනුෂ්‍යත්වයේ උදාවක් ~ පරිවර්තනීය ප්‍රජාවක්
          </p>
          <p className="text-[18px] [font-family:var(--font-noto-tamil),sans-serif] md:text-[clamp(0.9375rem,1.75vw,1.8125rem)]" lang="ta">
            மனித நேயத்தின் எழுச்சி ~ மாற்றம் பெறும் சமூகம்
          </p>
          <p className="font-serif text-[21px] italic md:text-[clamp(1rem,2.05vw,2.125rem)]" lang="en">
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
