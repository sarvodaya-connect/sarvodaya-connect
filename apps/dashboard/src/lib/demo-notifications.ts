import { canSeeNotification, type DemoViewer, type NotificationAudience } from "./access";
import { COMPLIANCE_AS_OF } from "./demo-compliance";

/**
 * Fictional notifications for the D19 notification centre. Each one has an
 * audience; the server only sends the notifications the viewer may see.
 * Replaced by the notification service later.
 */

export type NotificationCategory =
  | "APPROVAL"
  | "RETURNED"
  | "AUDIT"
  | "REQUEST"
  | "EMERGENCY"
  | "STALE_DATA"
  | "SYSTEM";

export const NOTIFICATION_CATEGORIES: { value: NotificationCategory; label: string; itemLabel: string }[] = [
  { value: "APPROVAL", label: "Approvals", itemLabel: "Pending approval" },
  { value: "RETURNED", label: "Returned", itemLabel: "Returned" },
  { value: "AUDIT", label: "Audits", itemLabel: "Audit reminder" },
  { value: "REQUEST", label: "Requests", itemLabel: "Document request" },
  { value: "EMERGENCY", label: "Emergency", itemLabel: "Emergency alert" },
  { value: "STALE_DATA", label: "Stale data", itemLabel: "Stale data" },
  { value: "SYSTEM", label: "System", itemLabel: "System" },
];

export type DashboardNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  occurredAt: string;
  read: boolean;
  /** Page that shows the item. Notifications without a link are information only. */
  href?: string;
};

type NotificationFixture = DashboardNotification & { audience: NotificationAudience };

const fixtures: NotificationFixture[] = [
  {
    id: "note-emergency",
    category: "EMERGENCY",
    title: "Incident INC-2026-07 activated: Cyclone, Eastern coast",
    occurredAt: "2026-11-12T02:00:00.000Z",
    read: false,
    audience: { roles: ["HQ_ADMIN"] },
  },
  {
    id: "note-review-queue",
    category: "APPROVAL",
    title: "2 submissions waiting in Kurunegala; 1 is past the 3-day target",
    occurredAt: "2026-11-12T01:30:00.000Z",
    read: false,
    href: "/reviews",
    audience: { roles: ["HQ_ADMIN", "DISTRICT_MANAGER"], districtIds: ["district-kurunegala"] },
  },
  {
    id: "note-registrar-kurunegala",
    category: "REQUEST",
    title: "Kurunegala District: 1 of 4 societies has sent all 4 Registrar documents",
    occurredAt: "2026-11-11T08:00:00.000Z",
    read: false,
    href: "/compliance?district=district-kurunegala",
    audience: { roles: ["HQ_ADMIN", "DISTRICT_MANAGER"], districtIds: ["district-kurunegala"] },
  },
  {
    id: "note-activity-evidence",
    category: "APPROVAL",
    title: "Tank cleaning photos from Pahala Kosgama are waiting for review",
    occurredAt: "2026-11-10T05:15:00.000Z",
    read: false,
    href: "/documents?society=society-pahala-kosgama",
    audience: {
      roles: ["HQ_ADMIN", "DISTRICT_MANAGER", "PROGRAMME_COORDINATOR"],
      districtIds: ["district-kurunegala"],
      societyIds: ["society-pahala-kosgama"],
    },
  },
  {
    id: "note-audit-overdue",
    category: "AUDIT",
    title: "2 societies have overdue FY 2025/26 audit reports",
    occurredAt: "2026-11-08T03:30:00.000Z",
    read: true,
    href: "/compliance?type=AUDIT_REPORT&status=MISSING",
    audience: { roles: ["HQ_ADMIN"] },
  },
  {
    id: "note-audit-overdue-kurunegala",
    category: "AUDIT",
    title: "Pahala Kosgama has not sent its FY 2025/26 audit report",
    occurredAt: "2026-11-08T03:30:00.000Z",
    read: true,
    href: "/compliance?district=district-kurunegala&type=AUDIT_REPORT&status=MISSING",
    audience: { roles: ["DISTRICT_MANAGER"], districtIds: ["district-kurunegala"] },
  },
  {
    id: "note-returned-wellawa",
    category: "RETURNED",
    title: "Wellawa audit report returned by R. Fernando",
    occurredAt: "2026-11-07T09:45:00.000Z",
    read: true,
    href: "/documents?society=society-wellawa",
    audience: { roles: ["HQ_ADMIN", "DISTRICT_MANAGER"], districtIds: ["district-kurunegala"] },
  },
  {
    id: "note-stale-galewela",
    category: "STALE_DATA",
    title: "Galewela has not confirmed its Executive Council for 90+ days",
    occurredAt: "2026-11-06T04:00:00.000Z",
    read: true,
    href: "/societies/society-galewela",
    audience: { roles: ["HQ_ADMIN"] },
  },
  {
    id: "note-library-approved",
    category: "APPROVAL",
    title: "Children's library opening photos from Rambukkana approved",
    occurredAt: "2026-09-13T06:30:00.000Z",
    read: true,
    href: "/documents?society=society-rambukkana",
    audience: {
      roles: ["HQ_ADMIN", "DISTRICT_MANAGER", "PROGRAMME_COORDINATOR"],
      districtIds: ["district-kegalle"],
      societyIds: ["society-rambukkana"],
    },
  },
  {
    id: "note-role-requests",
    category: "SYSTEM",
    title: "2 new dashboard users are waiting for a role",
    occurredAt: "2026-11-12T03:10:00.000Z",
    read: false,
    audience: { roles: ["HQ_ADMIN", "SYSTEM_ADMIN"] },
  },
  {
    id: "note-backup",
    category: "SYSTEM",
    title: "Nightly backup of the demonstration database completed",
    occurredAt: "2026-11-11T20:30:00.000Z",
    read: true,
    audience: { roles: ["SYSTEM_ADMIN"] },
  },
];

/** The notifications this viewer may see, newest first, without audience details. */
export function notificationsFor(viewer: DemoViewer): DashboardNotification[] {
  return fixtures
    .filter((notification) => canSeeNotification(viewer, notification.audience))
    .map(({ id, category, title, occurredAt, read, href }) => ({ id, category, title, occurredAt, read, href }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Colombo" });
const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" });

/** "Today, 07:30", "Yesterday" or "08 Nov 2026", relative to the demonstration date. */
export function formatNotificationTime(iso: string, now = `${COMPLIANCE_AS_OF}T12:00:00+05:30`): string {
  const date = new Date(iso);
  const today = dateKey.format(new Date(now));
  const yesterday = dateKey.format(new Date(new Date(now).getTime() - 24 * 60 * 60 * 1000));
  const day = dateKey.format(date);
  if (day === today) return `Today, ${timeFormat.format(date)}`;
  if (day === yesterday) return "Yesterday";
  return dayFormat.format(date);
}
