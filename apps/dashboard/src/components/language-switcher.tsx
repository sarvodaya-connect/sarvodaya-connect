"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLocale } from "@/app/locale-actions";
import { LOCALE_NAMES } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

/** Hidden while only one language is available. */
export function LanguageSwitcher() {
  const { available, locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  if (available.length < 2) return null;
  return (
    <div aria-label={t("language.choose")} className="inline-flex rounded-[10px] border border-line bg-surface p-1" role="group">
      {available.map((code) => (
        <button
          aria-pressed={locale === code}
          className={`rounded-lg px-2.5 py-1 text-xs ${locale === code ? "bg-brand-mint font-semibold text-brand-forest" : "text-ink-soft"}`}
          disabled={pending}
          key={code}
          lang={code}
          onClick={() =>
            start(async () => {
              await setLocale(code);
              router.refresh();
            })
          }
          type="button"
        >
          {LOCALE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}
