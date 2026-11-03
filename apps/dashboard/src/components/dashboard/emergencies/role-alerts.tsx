"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "../icon";

export type RoleAlert = {
  id: string;
  category: string;
  title: string;
  body?: string;
  linkPath?: string;
  read: boolean;
  createdAt: string;
};

/** "25 Oct, 6:10 a.m." in Sri Lanka time. */
function when(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Colombo" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Colombo" })
    .format(date)
    .replace("am", "a.m.")
    .replace("pm", "p.m.");
  return `${day}, ${time}`;
}

function iconFor(alert: RoleAlert) {
  if (alert.title.startsWith("Incident closed")) return { name: "success" as const, className: "text-ink-soft" };
  if (alert.category === "EMERGENCY") return { name: "alert" as const, className: "text-danger-text" };
  return { name: "flag" as const, className: "text-[#a07a10]" };
}

/**
 * V5 IR05: the SPC, DDM and DM header bell opens their latest notifications
 * from the API. Opening one marks it read and goes to the incident.
 */
export function RoleAlerts({ alerts, unreadCount, open: openAction }: { alerts: RoleAlert[] | null; unreadCount: number; open: (form: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} new` : "Notifications"}
        className="relative rounded-full p-1 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Icon className="size-5" name="bell" strokeWidth={2} />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-danger-dot px-0.5 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        // Fixed, because the header clips anything that overflows it.
        <section aria-label="Notifications" className="fixed right-4 top-[76px] z-50 w-[420px] max-w-[calc(100vw-32px)] rounded-card border border-line bg-surface p-3.5 shadow-2xl md:right-[60px]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-ink">Notifications</h2>
            <button className="text-[12px] font-semibold text-brand-forest underline underline-offset-2" onClick={() => setOpen(false)} type="button">Close</button>
          </div>
          {alerts === null ? (
            <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft" role="alert">Notifications could not be loaded. Refresh the page to try again.</p>
          ) : alerts.length ? (
            <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
              {alerts.map((alert) => {
                const icon = iconFor(alert);
                const isNewIncident = alert.category === "EMERGENCY" && alert.title.startsWith("New incident");
                return (
                  <li key={alert.id}>
                    <form action={openAction}>
                      <input name="notificationId" type="hidden" value={alert.id} />
                      <input name="linkPath" type="hidden" value={alert.linkPath ?? ""} />
                      <button className={`flex w-full gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-brand-mint-soft ${isNewIncident && !alert.read ? "bg-danger-bg" : ""}`} type="submit">
                        <Icon className={`mt-0.5 size-4 shrink-0 ${icon.className}`} name={icon.name} strokeWidth={2} />
                        <span className="min-w-0">
                          <strong className={`block text-[12.5px] ${alert.read ? "text-ink" : "text-brand-forest"}`}>{alert.title}</strong>
                          {alert.body && <span className="block text-[12px] text-ink-soft">{alert.body}</span>}
                          <span className="block text-[11px] text-muted">{when(alert.createdAt)}</span>
                        </span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">No notifications yet.</p>
          )}
          <p className="mt-2 text-[11px] text-ink-soft">Incident notifications go to everyone whose societies are in the incident area, and to HQ.</p>
        </section>
      )}
    </div>
  );
}
