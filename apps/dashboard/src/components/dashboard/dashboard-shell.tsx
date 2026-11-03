"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/identity-actions";
import { SHORT_ROLE_LABELS, type DemoViewer } from "@/lib/access";
import {
  headingFor,
  isActiveItem,
  navigationFor,
  searchActionFor,
  searchPlaceholderFor,
  type NavigationItem,
} from "@/lib/navigation";

import { GlobalSearchForm } from "./global-search-form";
import { Icon } from "./icon";
import { useNotifications } from "./notifications-context";

/** Hills along the bottom of the V5 header (HQTop). */
function HeaderHills() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 right-0 h-[46px] w-[62%]"
      preserveAspectRatio="none"
      viewBox="0 0 900 60"
    >
      <path d="M0 60 L380 30 L520 8 L640 26 L900 18 L900 60 Z" fill="var(--hill-header-back)" />
      <path d="M0 60 L300 52 L900 44 L900 60 Z" fill="var(--hill-header-front)" />
    </svg>
  );
}

function SidebarLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const active = isActiveItem(item, pathname);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-[11px] rounded-lg px-3 py-2 text-[12.5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active
          ? "bg-brand-mint font-semibold text-brand-forest"
          : "text-sidebar-text hover:bg-white/8 hover:text-white"
      }`}
      href={item.href}
    >
      <Icon className="size-4 shrink-0" name={item.icon} strokeWidth={2} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

/**
 * Prototype V5 desktop shell: 112px header with the logo column, page title,
 * search, alerts and account; 240px green sidebar with role navigation and the
 * signed-in user. Below the large breakpoint the sidebar becomes a scrolling
 * row of links under the header.
 */
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
  const scope = `${SHORT_ROLE_LABELS[viewer.role]} · ${viewer.scopeLabel}`;
  const homeHref = navigation.main[0]?.href ?? "/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="relative isolate flex min-h-[112px] shrink-0 items-center overflow-hidden border-b border-header-line bg-surface-wash">
        <HeaderHills />
        <Link
          aria-label="Sarvodaya Connect home"
          className="relative z-10 hidden w-[240px] shrink-0 justify-center lg:flex"
          href={homeHref}
        >
          <Image
            alt="Sarvodaya Connect"
            className="h-11 w-auto"
            height={180}
            priority
            src="/brand/sarvodaya-connect-wordmark.png"
            width={472}
          />
        </Link>
        <div className="relative z-10 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 md:px-7 lg:border-l lg:border-line lg:py-0 lg:pl-[22px]">
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-tight md:text-[22px]">{title}</h1>
            <p className="mt-0.5 text-[13px] text-ink-soft">{subtitle}</p>
            <p className="mt-1.5 text-[10.5px] text-muted">People | Communities | A Just and Compassionate Society</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden w-[300px] md:block">
              <GlobalSearchForm action={searchActionFor(viewer)} placeholder={searchPlaceholderFor(viewer)} />
            </div>
            <Link
              aria-label={unreadCount > 0 ? `Alerts, ${unreadCount} new` : "Alerts"}
              className="relative rounded-full p-1 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
              href="/notifications"
            >
              <Icon className="size-5" name="bell" strokeWidth={2} />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-danger-dot px-0.5 text-[9px] font-bold text-white"
                >
                  {unreadCount}
                </span>
              )}
            </Link>
            <form action={signOut}>
              <button
                aria-label={`Account: ${viewer.displayName} · sign out`}
                className="grid size-10 place-items-center rounded-full bg-brand-forest text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--brand-mint-ring)]"
                type="submit"
              >
                <Icon className="size-[18px]" name="user" strokeWidth={2} />
              </button>
            </form>
          </div>
          <div className="w-full md:hidden">
            <GlobalSearchForm action={searchActionFor(viewer)} placeholder={searchPlaceholderFor(viewer)} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Main navigation"
          className="hidden w-[240px] shrink-0 flex-col gap-0.5 bg-brand-forest px-3 py-4 text-sidebar-text lg:flex"
        >
          {navigation.main.map((item) => (
            <SidebarLink item={item} key={item.href} pathname={pathname} />
          ))}
          {navigation.secondary.length > 0 && (
            <>
              <span aria-hidden="true" className="mx-1 my-2.5 h-px bg-white/14" />
              {navigation.secondary.map((item) => (
                <SidebarLink item={item} key={item.href} pathname={pathname} />
              ))}
            </>
          )}
          <span className="flex-1" />
          <div className="sticky bottom-4 flex items-center gap-2.5 rounded-[10px] bg-white/8 p-2.5">
            <span
              aria-hidden="true"
              className="grid size-[30px] shrink-0 place-items-center rounded-full bg-white text-[10.5px] font-bold text-brand-forest"
            >
              {viewer.initials}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs text-white">{viewer.displayName}</strong>
              <span className="block truncate text-[10.5px]">{scope}</span>
            </span>
          </div>
        </nav>

        <nav aria-label="Main navigation" className="bg-brand-forest px-4 py-2 lg:hidden">
          <div className="flex gap-1.5 overflow-x-auto">
            {[...navigation.main, ...navigation.secondary].map((item) => {
              const active = isActiveItem(item, pathname);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs ${
                    active ? "bg-brand-mint font-semibold text-brand-forest" : "text-sidebar-text"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-sidebar-text">
            {viewer.displayName} · {scope}
          </p>
        </nav>

        <main className="min-w-0 flex-1 px-4 pb-8 pt-[18px] md:px-7">{children}</main>
      </div>
    </div>
  );
}
