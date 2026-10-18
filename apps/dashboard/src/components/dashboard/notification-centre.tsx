"use client";

import Link from "next/link";
import { useState } from "react";

import {
  type DashboardNotification,
  formatNotificationTime,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/demo-notifications";

import { EmptyState, secondaryButtonClass } from "./data-states";
import { Icon, type IconName } from "./icon";
import { useNotifications } from "./notifications-context";

const categoryStyle: Record<NotificationCategory, { icon: IconName; className: string }> = {
  APPROVAL: { icon: "clock", className: "bg-[#fff5d9] text-[#7a5a00]" },
  RETURNED: { icon: "undo", className: "bg-[#ffe9da] text-[#a2470f]" },
  AUDIT: { icon: "shield", className: "bg-[#fbe9e7] text-[#a8312a]" },
  REQUEST: { icon: "inbox", className: "bg-[#e5eef8] text-[#315d88]" },
  EMERGENCY: { icon: "alert", className: "bg-[#a8312a] text-white" },
  STALE_DATA: { icon: "refresh", className: "bg-[#f0f1ee] text-[#55605a]" },
  SYSTEM: { icon: "building", className: "bg-[#e6f0e7] text-[#26744b]" },
};

/** D19 · All alerts and updates for the signed-in role in one place. */
export function NotificationCentre({ showEmpty = false }: { showEmpty?: boolean }) {
  const { markAllRead, markRead, notifications: all, unreadCount } = useNotifications();
  const [category, setCategory] = useState<"all" | NotificationCategory>("all");
  const notifications = showEmpty ? [] : all;
  const unread = showEmpty ? 0 : unreadCount;
  const categories = NOTIFICATION_CATEGORIES.filter((item) =>
    notifications.some((notification) => notification.category === item.value),
  );
  const visible = notifications.filter((notification) => category === "all" || notification.category === category);

  return (
    <section className="mt-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-[#68756c]" role="status">
          {unread === 0 ? "All caught up" : `${unread} unread`} · history kept for 12 months
        </p>
        <button
          className={`${secondaryButtonClass} px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={unread === 0}
          onClick={markAllRead}
          type="button"
        >
          Mark all read
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]">
          <EmptyState
            description="Approvals, returned submissions, reminders and alerts for your role will appear here."
            icon="bell"
            title="No notifications yet"
          />
        </div>
      ) : (
        <>
          <div aria-label="Filter notifications" className="mt-4 flex flex-wrap gap-2" role="group">
            {[{ value: "all" as const, label: "All" }, ...categories].map((item) => {
              const active = category === item.value;
              return (
                <button
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd] ${
                    active
                      ? "border-[#123d29] bg-[#123d29] text-white"
                      : "border-[#d8dfd8] bg-white text-[#3e4b43] hover:bg-[#f4f8f3]"
                  }`}
                  key={item.value}
                  onClick={() => setCategory(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#dfe5dc] bg-white">
              <EmptyState
                action={
                  <button className={secondaryButtonClass} onClick={() => setCategory("all")} type="button">
                    Show all notifications
                  </button>
                }
                description="There are no notifications in this category."
                icon="bell"
                title="Nothing here"
              />
            </div>
          ) : (
            <ul
              aria-label="Notifications"
              className="mt-4 divide-y divide-[#edf0eb] overflow-hidden rounded-xl border border-[#dfe5dc] bg-white shadow-[0_8px_26px_rgba(24,56,35,0.04)]"
            >
              {visible.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onRead={markRead} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: DashboardNotification;
  onRead: (id: string) => void;
}) {
  const style = categoryStyle[notification.category];
  const categoryLabel = NOTIFICATION_CATEGORIES.find((item) => item.value === notification.category)!.itemLabel;
  const unread = !notification.read;
  const content = (
    <>
      <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full ${style.className}`}>
        <Icon className="size-4" name={style.icon} />
      </span>
      <span className="min-w-0 flex-1">
        {unread && <span className="sr-only">Unread: </span>}
        <span className={`block text-sm ${unread ? "font-semibold text-[#17211b]" : "font-normal text-[#3e4b43]"}`}>
          {notification.title}
        </span>
        <span className="mt-0.5 block text-xs text-[#738078]">
          {categoryLabel} · {formatNotificationTime(notification.occurredAt)}
        </span>
      </span>
      {unread ? (
        <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[#26744b]" data-testid="unread-dot" />
      ) : (
        notification.href && <Icon aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#9aa69e]" name="chevron" />
      )}
    </>
  );
  const className = `flex w-full items-start gap-3 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#26744b] ${
    unread ? "border-l-[3px] border-[#26744b] bg-[#f4f8f3] hover:bg-[#edf5ee]" : "border-l-[3px] border-transparent hover:bg-[#f8faf6]"
  }`;

  return (
    <li>
      {notification.href ? (
        <Link className={className} href={notification.href} onClick={() => onRead(notification.id)}>
          {content}
        </Link>
      ) : (
        <button
          className={className}
          onClick={() => onRead(notification.id)}
          type="button"
        >
          {content}
        </button>
      )}
    </li>
  );
}
