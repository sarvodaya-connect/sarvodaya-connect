"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { DashboardNotification } from "@/lib/demo-notifications";

type NotificationsValue = {
  notifications: DashboardNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * Holds the viewer's notifications so the header bell and the notification
 * centre stay in step. Read state is kept in the browser for the demonstration;
 * the notification service will store it later.
 */
export function NotificationsProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: DashboardNotification[];
}) {
  const [notifications, setNotifications] = useState(initial);

  const value = useMemo<NotificationsValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
      markRead: (id) =>
        setNotifications((items) =>
          items.map((item) => (item.id === id ? { ...item, read: true } : item)),
        ),
      markAllRead: () => setNotifications((items) => items.map((item) => ({ ...item, read: true }))),
    }),
    [notifications],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationsProvider.");
  return value;
}
