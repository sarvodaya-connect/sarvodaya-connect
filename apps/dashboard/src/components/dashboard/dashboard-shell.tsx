"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { switchDemoViewer } from "@/app/(dashboard)/actions";
import {
  canViewCompliance,
  canViewDocumentLibrary,
  type DemoViewer,
  demoViewers,
} from "@/lib/access";

import { Brand } from "./brand";
import { GlobalSearchForm } from "./global-search-form";
import { Icon, type IconName } from "./icon";
import { useNotifications } from "./notifications-context";

type NavigationItem = { href: string; icon: IconName; label: string };

/** Primary navigation (catalogue D02 sidebar). Pages the viewer's role cannot open are left out. */
export function navigationFor(viewer: DemoViewer): NavigationItem[] {
  if (viewer.role === "SYSTEM_ADMIN") {
    // Technical settings only: no society registry, district or review pages.
    return [
      { href: "/admin", icon: "building", label: "Platform access" },
      { href: "/notifications", icon: "bell", label: "Notifications" },
    ];
  }
  return [
    {
      href: "/dashboard",
      icon: "home",
      label: viewer.role === "DISTRICT_MANAGER" ? "District Home" : "National Overview",
    },
    { href: "/districts/kurunegala", icon: "district", label: "District View" },
    { href: "/societies", icon: "society", label: "Societies" },
    { href: "/reviews", icon: "review", label: "Review Queue" },
    { href: "/activities", icon: "clipboard", label: "Activities" },
    { href: "/emergencies", icon: "alert", label: "Emergency response" },
    { href: "/membership", icon: "clipboard", label: "Membership" },
    ...(canViewCompliance(viewer)
      ? [{ href: "/compliance", icon: "shield", label: "Audits" } satisfies NavigationItem]
      : []),
    ...(canViewDocumentLibrary(viewer)
      ? [{ href: "/documents", icon: "document", label: "Documents" } satisfies NavigationItem]
      : []),
    { href: "/notifications", icon: "bell", label: "Notifications" },
  ];
}

function headingFor(pathname: string, viewer: DemoViewer): { title: string; subtitle: string } {
  const page = pathname.startsWith("/admin")
    ? "Administration"
    : pathname.startsWith("/states")
      ? "Page states"
      : /^\/societies\/[^/]+/.test(pathname)
        ? "Society Profile"
        : pathname.startsWith("/societies")
        ? "Societies"
        : pathname.startsWith("/membership")
          ? "Membership"
          : pathname.startsWith("/activities")
            ? "Activities"
            : pathname.startsWith("/emergencies")
              ? "Emergency response"
          : pathname.startsWith("/districts")
            ? "District View"
            : pathname.startsWith("/reviews")
              ? "Review Queue"
              : pathname.startsWith("/compliance")
                ? "Audits & compliance"
                : pathname.startsWith("/documents")
                  ? "Documents"
                  : pathname.startsWith("/search")
                    ? "Global search"
                    : pathname.startsWith("/notifications")
                      ? "Notification centre"
                      : viewer.role === "DISTRICT_MANAGER"
                        ? "District Dashboard"
                        : "National Dashboard";
  const subtitle =
    viewer.role === "DISTRICT_MANAGER"
      ? "Kurunegala District Centre · 106 societies"
      : "Shramadana Societies Across Sri Lanka";
  return { title: page, subtitle };
}

export function DashboardShell({
  children,
  viewer,
}: {
  children: React.ReactNode;
  viewer: DemoViewer;
}) {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();
  const navigation = navigationFor(viewer);
  const { title, subtitle } = headingFor(pathname, viewer);
  const isActive = (href: string) => {
    const hrefPath = href.split("?")[0];
    return pathname === hrefPath || (hrefPath !== "/dashboard" && pathname.startsWith(`${hrefPath}/`));
  };

  return (
    <div className="min-h-screen bg-[#f4f5ef]">
      <header className="relative isolate z-20 flex overflow-hidden border-b border-[#dfe5dc] bg-[#fcfcf8]">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 120">
          <path d="M560 104 700 50l110 34 90-30 110 38 190-40v68H560Z" fill="#d9e8d2" />
          <path d="M470 120c170-46 352-48 520-34 95 8 150 0 210-24v58Z" fill="#a9ce9d" />
          <g fill="#286a43"><circle cx="1050" cy="98" r="15" /><circle cx="1090" cy="82" r="22" /><circle cx="1135" cy="100" r="16" /><circle cx="1180" cy="80" r="28" /></g>
          <g fill="#174a32"><circle cx="1082" cy="104" r="15" /><circle cx="1165" cy="106" r="18" /></g>
        </svg>
        <div className="relative z-10 hidden w-[248px] shrink-0 items-center justify-center border-r border-[#dfe5dc] bg-white px-5 py-3 lg:flex">
          <Brand sidebar />
        </div>
        <div className="relative z-10 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-[-0.02em] text-[#173b2a] md:text-[26px]">{title}</h1>
            <p className="mt-0.5 text-[13px] text-[#26362c] md:text-[15px]">{subtitle}</p>
            <p className="mt-1 text-[11px] text-[#526057]">People&nbsp; | &nbsp;Communities&nbsp; | &nbsp;A Just and Compassionate Society</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden w-[min(32vw,360px)] md:block"><GlobalSearchForm /></div>
            <Link
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
              className="relative grid size-10 place-items-center rounded-full border border-white/70 bg-white/90 text-[#26362c] shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd]"
              href="/notifications"
            >
              <Icon className="size-[19px]" name="bell" />
              {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[#c0392b] px-1 text-[10px] font-bold leading-[18px] text-white">{unreadCount}</span>}
            </Link>
            <span aria-label={viewer.displayName} className="hidden size-10 place-items-center rounded-full bg-[#123d29] text-xs font-bold text-white sm:grid">{viewer.initials}</span>
          </div>
          <div className="w-full md:hidden"><GlobalSearchForm /></div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="hidden flex-col bg-[#123d29] text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
          <nav className="mt-3 space-y-0.5 px-2.5" aria-label="Primary navigation">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition ${
                    active
                      ? "bg-[#e6f0e7] text-[#123d29]"
                      : "text-[#dce9de] hover:bg-white/8 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="size-[17px]" name={item.icon} />
                  {item.label}
                  {item.href === "/reviews" && (
                    <span className="ml-auto rounded-full bg-[#f3c44e] px-2 py-0.5 text-[10px] font-bold text-[#503b00]">
                      2
                    </span>
                  )}
                  {item.href === "/notifications" && unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-[#f3c44e] px-2 py-0.5 text-[10px] font-bold text-[#503b00]">
                      {unreadCount}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-white/10 p-3">
            <div className="rounded-lg bg-white/6 p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-[#dce9de] text-[11px] font-bold text-[#123d29]">
                  {viewer.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs">{viewer.displayName}</strong>
                  <span className="block truncate text-[10px] text-[#a8c7b1]">
                    {viewer.roleLabel} · {viewer.scopeLabel}
                  </span>
                </span>
                <Link aria-label="Sign out" href="/">
                  <Icon className="size-4 text-[#a8c7b1]" name="logout" />
                </Link>
              </div>
              <div className="mt-3 border-t border-white/10 pt-3">
                <ViewerSwitcher viewer={viewer} />
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="border-b border-[#dfe5dc] bg-[#123d29] px-4 py-2 lg:hidden">
            <nav className="flex gap-2 overflow-x-auto" aria-label="Mobile navigation">
              {navigation.map((item) => (
                <Link
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${
                    isActive(item.href) ? "bg-white text-[#123d29]" : "text-white/80"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-2"><ViewerSwitcher viewer={viewer} /></div>
          </div>
          <main className="px-5 py-6 md:px-7 md:py-7 xl:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

/**
 * Demonstration control: choose which fictional staff member is viewing the
 * dashboard, to show the role-based visibility rules. Replaced by sign-in later.
 */
function ViewerSwitcher({ viewer }: { viewer: DemoViewer }) {
  return (
    <form action={switchDemoViewer} className="flex items-center gap-2">
      <label className="flex w-full flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a8c7b1]">
        Demonstration · viewing as
        <select
          className="w-full rounded-md border border-white/20 bg-[#174a32] px-2 py-1.5 text-[11px] font-medium normal-case tracking-normal text-white outline-none focus:border-[#8db39a]"
          defaultValue={viewer.id}
          key={viewer.id}
          name="viewer"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {demoViewers.map((option) => (
            <option key={option.id} value={option.id}>
              {option.roleLabel} · {option.displayName}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button className="rounded-lg border border-[#ccd6ce] px-2.5 py-1.5 text-xs font-semibold" type="submit">
          Switch
        </button>
      </noscript>
    </form>
  );
}
