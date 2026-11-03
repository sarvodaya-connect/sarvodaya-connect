import Link from "next/link";

import { signOut } from "@/app/identity-actions";
import { secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { getCurrentViewer } from "@/lib/current-viewer";

/**
 * V5 D17 Settings (HQ): the profile, sign-out, language and password parts
 * the prototype defines. Notification preferences are To Confirm (nothing
 * stores them yet), so they are not shown.
 */
export default async function SettingsPage() {
  const viewer = await getCurrentViewer();
  return (
    <div className="max-w-[720px] space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">Settings</h1>
        <p className="text-[12px] text-ink-soft">Your profile and preferences</p>
      </div>

      <section aria-label="Profile" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-full bg-brand-forest text-[13px] font-bold text-white">{viewer.initials}</span>
          <div>
            <p className="text-[14px] font-bold text-ink">{viewer.displayName}</p>
            <p className="text-[12px] text-muted">HQ Administrator · {viewer.scopeLabel}</p>
          </div>
        </div>
        <form action={signOut}>
          <button className="inline-flex items-center gap-2 rounded-button border border-[#e8b7b2] bg-surface px-3 py-2 text-[12px] font-semibold text-[#a8312a] hover:bg-danger-bg" type="submit">
            <Icon className="size-4" name="logout" />
            Sign out
          </button>
        </form>
      </section>

      <section aria-labelledby="language-heading" className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[14px] font-bold text-ink" id="language-heading">Language</h2>
        <p className="mt-2 text-[12px] text-ink">English</p>
        <p className="mt-1 text-[11px] text-muted">
          The dashboard is shown in English. The phone app offers සිංහල, தமிழ் and English; Sinhala and Tamil on the dashboard are not available yet.
        </p>
      </section>

      <section aria-labelledby="password-heading" className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-[14px] font-bold text-ink" id="password-heading">Password</h2>
        <p className="mt-2 text-[12px] text-ink-soft">
          Your password was set by an HQ administrator. To change it, ask another HQ administrator to set a new one in Administration.
        </p>
        <Link className={`${secondaryButtonClass} mt-3`} href="/accounts">
          <Icon className="size-4" name="key" />
          Open Administration
        </Link>
      </section>
    </div>
  );
}
