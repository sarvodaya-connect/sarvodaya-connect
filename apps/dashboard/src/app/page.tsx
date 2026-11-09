import Image from "next/image";

import { SignInForm } from "@/components/dashboard/identity-forms";
import { getT } from "@/i18n/server";

/** V5 D01 / D01e: dashboard sign-in. */
export default async function Home() {
  const t = await getT();
  return (
    <main className="grid min-h-screen grid-cols-1 bg-surface md:grid-cols-[48.7%_51.3%]">
      <aside className="relative isolate flex min-h-[240px] flex-col justify-end overflow-hidden bg-brand-forest p-7 text-white md:min-h-0 md:p-9">
        <Image
          alt=""
          className="-z-10 object-cover object-top"
          fill
          priority
          sizes="(min-width: 768px) 49vw, 100vw"
          src="/brand/sign-in-village.jpg"
        />
        {/* Dark green fade so the footer stays readable over the illustration. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(31,60,42,0)_38%,rgba(31,60,42,0.86)_66%,rgba(31,60,42,0.94)_100%)]"
        />
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
