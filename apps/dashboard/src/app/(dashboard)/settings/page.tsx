import Link from "next/link";

import { signOut } from "@/app/identity-actions";
import { secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { LanguageSwitcher } from "@/components/language-switcher";
import { availableLocales } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { getCurrentViewer } from "@/lib/current-viewer";

/**
 * V5 D17 Settings (HQ): the profile, sign-out, language and password parts
 * the prototype defines. Notification preferences are To Confirm (nothing
 * stores them yet), so they are not shown.
 */
export default async function SettingsPage() {
  const [viewer, t] = await Promise.all([getCurrentViewer(), getT()]);
  const canChoose = availableLocales().length > 1;
  return (
    <div className="max-w-[720px] space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">{t("settings.title")}</h1>
        <p className="text-[12px] text-ink-soft">{t("settings.subtitle")}</p>
      </div>

      <section aria-label={t("settings.profile")} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-full bg-brand-forest text-[13px] font-bold text-white">{viewer.initials}</span>
          <div>
            <p className="text-[14px] font-bold text-ink">{viewer.displayName}</p>
            <p className="text-[12px] text-muted">{t("settings.hqAdministrator", { scope: t("scope.national") })}</p>
          </div>
        </div>
        <form action={signOut}>
          <button className="inline-flex items-center gap-2 rounded-button border border-[#e8b7b2] bg-surface px-3 py-2 text-[12px] font-semibold text-[#a8312a] hover:bg-danger-bg" type="submit">
            <Icon className="size-4" name="logout" />
            {t("settings.signOut")}
          </button>
        </form>
      </section>

      <section aria-labelledby="language-heading" className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[14px] font-bold text-ink" id="language-heading">{t("settings.language")}</h2>
        <div className="mt-2"><LanguageSwitcher /></div>
        <p className="mt-2 text-[11px] text-muted">{t(canChoose ? "settings.languageHelp" : "settings.languageEnglishOnly")}</p>
      </section>

      <section aria-labelledby="password-heading" className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[14px] font-bold text-ink" id="password-heading">{t("settings.password")}</h2>
        <p className="mt-2 text-[12px] text-ink-soft">
          {t("settings.passwordHelp")}
        </p>
        <Link className={`${secondaryButtonClass} mt-3`} href="/accounts">
          <Icon className="size-4" name="key" />
          {t("settings.openAdministration")}
        </Link>
      </section>
    </div>
  );
}
