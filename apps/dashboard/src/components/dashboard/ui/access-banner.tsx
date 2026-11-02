import type { ReactNode } from "react";

import { Icon, type IconName } from "../icon";

/**
 * V5 banner that tells the viewer what they can do on a page, for example
 * "Your access: 12 assigned societies · view and edit" (SP01), "view only"
 * (DM03), a temporary district-wide view (DD02) or an active incident.
 * It only describes access; the API decides what each request may do.
 */
export type AccessBannerTone = "edit" | "viewOnly" | "temporary" | "incident";

const tones: Record<AccessBannerTone, { className: string; icon: IconName }> = {
  edit: {
    className: "border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] text-[var(--banner-edit-text)]",
    icon: "shield",
  },
  viewOnly: {
    className: "border-[var(--banner-view-line)] bg-[var(--banner-view-bg)] text-[var(--banner-view-text)]",
    icon: "lock",
  },
  temporary: {
    className:
      "border-[var(--banner-temporary-line)] bg-[var(--banner-temporary-bg)] text-[var(--banner-temporary-text)]",
    icon: "clock",
  },
  incident: {
    className:
      "border-[var(--banner-incident-line)] bg-[var(--banner-incident-bg)] text-[var(--banner-incident-text)]",
    icon: "alert",
  },
};

export function AccessBanner({
  action,
  children,
  tone,
}: {
  /** Right-hand detail or link, such as "Ends Fri 31 Oct · 4 days left" or "Open incident". */
  action?: ReactNode;
  children: ReactNode;
  tone: AccessBannerTone;
}) {
  const { className, icon } = tones[tone];
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border px-3.5 py-2.5 text-[12.5px] ${className}`}
      role={tone === "incident" ? "alert" : "note"}
    >
      <Icon className="size-4 shrink-0" name={icon} strokeWidth={2} />
      <span className="min-w-0 flex-1">{children}</span>
      {action && <span className="text-xs font-semibold">{action}</span>}
    </div>
  );
}
