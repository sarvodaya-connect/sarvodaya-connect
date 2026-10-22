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

/** Primary navigation. Pages the viewer's role cannot open are left out. */
export function navigationFor(viewer: DemoViewer): NavigationItem[] {
  if (viewer.role === "SYSTEM_ADMIN") {
    // Technical settings only: no society registry, district or review pages.
    return [
      { href: "/admin", icon: "building", label: "Platform access" },
      { href: "/notifications", icon: "bell", label: "Notifications" },
    ];
  }
  return [
    { href: "/dashboard", icon: "home", label: "Overview" },
    { href: "/societies", icon: "society", label: "Societies" },
    { href: "/membership", icon: "clipboard", label: "Membership" },
    { href: "/search", icon: "search", label: "Global search" },
    { href: "/districts/kurunegala", icon: "district", label: "District view" },
    { href: "/reviews", icon: "review", label: "Review queue" },
    ...(canViewCompliance(viewer)
      ? [{ href: "/compliance", icon: "shield", label: "Audits & compliance" } satisfies NavigationItem]
      : []),
    ...(canViewDocumentLibrary(viewer)
      ? [{ href: "/documents", icon: "document", label: "Documents" } satisfies NavigationItem]
      : []),
    { href: "/notifications", icon: "bell", label: "Notifications" },
  ];
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
  const heading = pathname.startsWith("/admin")
    ? "Administration"
    : pathname.startsWith("/states")
      ? "Page states"
      : pathname.startsWith("/societies")
        ? "Societies"
        : pathname.startsWith("/membership")
          ? "Membership"
          : pathname.startsWith("/districts")
            ? "District view"
            : pathname.startsWith("/reviews")
              ? "Review queue"
              : viewer.role === "DISTRICT_MANAGER"
                ? "District Dashboard"
                : viewer.role === "PROGRAMME_COORDINATOR"
                  ? "My Programmes"
                  : "National Dashboard";

  return (
    <div className="min-h-screen bg-[#f4f5ef] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden min-h-screen flex-col bg-[#123d29] text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-white/10 px-6 py-6">
          <Brand sidebar />
        </div>
        <p className="px-6 pt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8db39a]">
          Workspace
        </p>
        <nav className="mt-3 space-y-1 px-3" aria-label="Primary navigation">
          {navigation.map((item) => {
            const hrefPath = item.href.split("?")[0];
            const active = pathname === hrefPath || (hrefPath !== "/dashboard" && pathname.startsWith(`${hrefPath}/`));
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-[#e6f0e7] text-[#123d29] shadow-sm"
                    : "text-[#dce9de] hover:bg-white/8 hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="size-[18px]" name={item.icon} />
                {item.label}
                {item.label === "Review queue" && (
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
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/6 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#dce9de] text-xs font-bold text-[#123d29]">
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
        </div>
      </aside>

      <div className="min-w-0">
        <header className="relative isolate z-20 overflow-hidden border-b border-[#dfe5dc] bg-[#fcfcf8] px-4 py-4 md:px-8">
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 190">
            <path d="M470 153 660 66l128 56 102-44 126 58 184-55v109H470Z" fill="#d9e8d2" />
            <path d="M360 190c170-72 352-76 520-53 125 17 217-1 320-43v96Z" fill="#a9ce9d" />
            <path d="M720 190c125-59 276-54 480-75v75Z" fill="#80b56f" />
            <g fill="#286a43"><circle cx="1030" cy="137" r="23" /><circle cx="1082" cy="111" r="34" /><circle cx="1129" cy="145" r="25" /><circle cx="1180" cy="110" r="42" /></g>
            <g fill="#174a32"><circle cx="1074" cy="151" r="24" /><circle cx="1161" cy="153" r="29" /></g>
          </svg>
          <div className="relative z-10 flex min-h-[136px] flex-col justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-[-0.025em] text-[#173b2a] sm:text-2xl md:text-[28px]">{heading}</h1>
                <p className="mt-1 text-[11px] text-[#526057] sm:text-xs">Shramadana Societies Across Sri Lanka</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden w-[min(36vw,420px)] md:block"><GlobalSearchForm /></div>
                <Link
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                  className="relative grid size-10 place-items-center rounded-full border border-white/70 bg-white/90 text-[#26362c] shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#dbeadd]"
                  href="/notifications"
                >
                  <Icon className="size-[19px]" name="bell" />
                  {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-[#c0392b] px-1 text-[10px] font-bold leading-[18px] text-white">{unreadCount}</span>}
                </Link>
                <span aria-label={viewer.displayName} className="hidden size-10 place-items-center rounded-full bg-[#e6f0e7] text-xs font-bold text-[#174a32] sm:grid">{viewer.initials}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="md:hidden min-w-0 flex-1"><GlobalSearchForm /></div>
              <div className="flex flex-wrap items-center gap-3">
                <ViewerSwitcher viewer={viewer} />
                <span className="rounded-full border border-[#e5d59f] bg-[#fff9e9] px-3 py-1 text-[11px] font-semibold text-[#755a08]">Demonstration Data</span>
              </div>
            </div>
          </div>
        </header>
        <div className="border-b border-[#dfe5dc] bg-[#123d29] px-4 py-2 lg:hidden">
          <nav className="flex gap-2 overflow-x-auto" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${
                  (pathname === item.href || pathname.startsWith(`${item.href}/`))
                    ? "bg-white text-[#123d29]"
                    : "text-white/80"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <main className="px-5 py-7 md:px-8 md:py-9 xl:px-10">{children}</main>
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
      <label className="flex items-center gap-2 text-[11px] font-semibold text-[#66756b]">
        Viewing as
        <select
          className="max-w-[230px] rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] px-2.5 py-1.5 text-xs font-medium text-[#26362c] outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
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
