"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

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

import { useI18n } from "@/i18n/provider";
import type { Translator } from "@/i18n/translate";

import { GlobalSearchForm } from "./global-search-form";
import { Icon } from "./icon";
import styles from "./shell.module.css";

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

/** The viewer's reach. A district's name is stored data, so it stays as it is. */
function scopeFor(viewer: DemoViewer, t: Translator) {
  if (viewer.scopeLabel === "National") return t("scope.national");
  if (/^\d+ societ(y|ies)$/.test(viewer.scopeLabel)) return t.plural("scope.societies", viewer.societyIds?.length ?? 0);
  return viewer.scopeLabel;
}

type ShellProps = {
  /** V5 IR05: the role bell with its notifications. HQ keeps the link to the alerts page. */
  alerts?: React.ReactNode;
  children: React.ReactNode;
  /** Demonstration mode only: "Preview as" another desktop role. Never set in production. */
  preview?: ShellPreview;
  /** The signed-in user's unread alerts, from the API. */
  unreadCount?: number;
  viewer: DemoViewer;
};

/** Demonstration mode only: preview the dashboard as another desktop role. */
export type ShellPreview = {
  action: (formData: FormData) => void | Promise<void>;
  current: string;
  options: { id: string; label: string }[];
};

/** The desktop roles on the redesigned shell. Platform administration keeps the V5 shell. */
const REDESIGNED_ROLES: readonly DemoViewer["role"][] = ["HQ_ADMIN", "DISTRICT_MANAGER", "DEPUTY_DISTRICT_MANAGER", "PROGRAMME_COORDINATOR"];

/**
 * HQ, DM, DDM and SPC get the redesigned shell; the System Administrator keeps
 * the V5 shell exactly as it was.
 */
export function DashboardShell(props: ShellProps) {
  return REDESIGNED_ROLES.includes(props.viewer.role) ? <RedesignedShell {...props} /> : <StandardShell {...props} />;
}

/**
 * Prototype V5 desktop shell: 112px header with the logo column, page title,
 * search, alerts and account; 240px green sidebar with role navigation and the
 * signed-in user. Below the large breakpoint the sidebar becomes a scrolling
 * row of links under the header.
 */
function StandardShell({ alerts, children, unreadCount = 0, viewer }: ShellProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const navigation = navigationFor(viewer, t);
  const { title, subtitle } = headingFor(pathname, viewer, t);
  const scope = `${viewer.role === "SYSTEM_ADMIN" ? t("role.systemAdmin") : SHORT_ROLE_LABELS[viewer.role]} · ${scopeFor(viewer, t)}`;
  const homeHref = navigation.main[0]?.href ?? "/dashboard";
  // The translation decides what goes around the brand, and the brand stays whole.
  const [askBefore, askAfter] = t("shell.ask").split("{brand}");

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="relative isolate flex min-h-[112px] shrink-0 items-center overflow-hidden border-b border-header-line bg-surface-wash">
        <HeaderHills />
        <Link
          aria-label={t("shell.home")}
          className="relative z-10 hidden w-[240px] shrink-0 justify-center lg:flex"
          href={homeHref}
        >
          <Image
            alt="Sarvodaya Connect"
            className="h-auto w-[192px] max-w-full"
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
            <p className="mt-1.5 text-[10.5px] text-muted">{t("shell.tagline")}</p>
          </div>
          <div className="flex items-center gap-4">
            {viewer.role === "HQ_ADMIN" && (
              // V5 HQTop: SarvoAI is HQ only (the API refuses every other role).
              <Link
                className="hidden items-center gap-1.5 rounded-button bg-brand-forest px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#174f34] sm:inline-flex"
                href="/sarvoai"
              >
                <Icon className="size-4 text-[#f3c44e]" name="sparkle" />
                <span>{askBefore}Sarvo<span className="text-[#f0a040]">AI</span>{askAfter}</span>
              </Link>
            )}
            <div className="hidden w-[300px] md:block">
              <GlobalSearchForm action={searchActionFor(viewer)} placeholder={searchPlaceholderFor(viewer, t)} />
            </div>
            {alerts ?? (
              <Link
                aria-label={unreadCount > 0 ? t("shell.alertsNew", { count: unreadCount }) : t("shell.alerts")}
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
            )}
            <form action={signOut}>
              <button
                aria-label={t("shell.accountSignOut", { name: viewer.displayName })}
                className="grid size-10 place-items-center rounded-full bg-brand-forest text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--brand-mint-ring)]"
                type="submit"
              >
                <Icon className="size-[18px]" name="user" strokeWidth={2} />
              </button>
            </form>
          </div>
          <div className="w-full md:hidden">
            <GlobalSearchForm action={searchActionFor(viewer)} placeholder={searchPlaceholderFor(viewer, t)} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label={t("shell.mainNavigation")}
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

        <nav aria-label={t("shell.mainNavigation")} className="bg-brand-forest px-4 py-2 lg:hidden">
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

/* --- Redesigned shell (2026): HQ, DM, DDM and SPC ------------------------- */

/** A soft line of hills along the foot of the sidebar: Sarvodaya's landscape, kept quiet. */
function SidebarHills() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] w-full" preserveAspectRatio="none" viewBox="0 0 240 90">
      <path d="M0 90 L0 52 Q40 30 82 46 T160 38 T240 30 L240 90 Z" fill="rgb(255 255 255 / 0.035)" />
      <path d="M0 90 L0 70 Q60 52 120 64 T240 56 L240 90 Z" fill="rgb(255 255 255 / 0.05)" />
    </svg>
  );
}

function ShellSidebarLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const active = isActiveItem(item, pathname);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-[11px] rounded-[10px] px-3 py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active ? "font-semibold text-brand-forest" : "text-sidebar-text hover:bg-white/[0.07] hover:text-white"
      }`}
      data-active={active || undefined}
      href={item.href}
    >
      <Icon className={`${styles.navIcon} size-4 shrink-0`} name={item.icon} strokeWidth={2} />
      <span className="min-w-0 flex-1 break-words">{item.label}</span>
    </Link>
  );
}

/** The active page's pill, which slides to the new page instead of jumping. */
function useActivePill(pathname: string) {
  const nav = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const active = nav.current?.querySelector<HTMLElement>("[data-active]");
      setPill(active ? { top: active.offsetTop, height: active.offsetHeight } : null);
    };
    measure();
    // Longer Sinhala or Tamil labels, a font loading or a resize move the item.
    if (typeof ResizeObserver === "undefined" || !nav.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(nav.current);
    return () => observer.disconnect();
  }, [pathname]);
  return { nav, pill };
}

function PreviewSwitch({ id, preview }: { id: string; preview: ShellPreview }) {
  const { t } = useI18n();
  return (
    <form action={preview.action} className="rounded-[10px] border border-dashed border-white/25 p-2.5">
      <label className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#f3c44e]" htmlFor={id}>
        {t("shell.previewAs")}
      </label>
      <select
        className="mt-1 w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        defaultValue={preview.current}
        id={id}
        name="viewer"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {preview.options.map((option) => (
          <option className="text-ink" key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <noscript>
        <button className="mt-1 text-[11px] text-white underline" type="submit">
          {t("shell.previewGo")}
        </button>
      </noscript>
    </form>
  );
}

/**
 * The redesigned shell: a full-height green sidebar with the role's navigation
 * and the signed-in user, and a slim sticky header with the page title,
 * SarvoAI (HQ only), search, alerts and account. Below the large breakpoint the sidebar becomes a
 * scrolling row of links under the header. Each page eases in when the route
 * changes; prefers-reduced-motion turns that and the sliding pill off.
 */
function RedesignedShell({ alerts, children, preview, unreadCount = 0, viewer }: ShellProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const navigation = navigationFor(viewer, t);
  const { title, subtitle } = headingFor(pathname, viewer, t);
  const scope = `${SHORT_ROLE_LABELS[viewer.role]} · ${scopeFor(viewer, t)}`;
  const homeHref = navigation.main[0]?.href ?? "/dashboard";
  // The translation decides what goes around the brand, and the brand stays whole.
  const [askBefore, askAfter] = t("shell.ask").split("{brand}");
  const { nav, pill } = useActivePill(pathname);

  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="relative hidden h-screen flex-col overflow-hidden bg-brand-forest text-sidebar-text lg:sticky lg:top-0 lg:flex">
        <Link
          aria-label={t("shell.home")}
          className="flex h-[112px] shrink-0 items-center justify-center px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
          href={homeHref}
        >
          <Image alt="Sarvodaya Connect" className="h-auto w-[208px] max-w-full" height={450} priority src="/brand/sarvodaya-connect-logo-white.png" width={1180} />
        </Link>
        <nav aria-label={t("shell.mainNavigation")} className="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4 pt-2" ref={nav}>
          {pill && (
            <span
              aria-hidden="true"
              className={`${styles.navPill} pointer-events-none absolute inset-x-3 top-0 rounded-[10px] bg-brand-mint shadow-[0_6px_16px_-10px_rgb(0_0_0/0.6)]`}
              style={{ height: pill.height, transform: `translateY(${pill.top}px)` }}
            />
          )}
          {navigation.main.map((item) => (
            <ShellSidebarLink item={item} key={item.href} pathname={pathname} />
          ))}
          {navigation.secondary.length > 0 && (
            <>
              <span aria-hidden="true" className="mx-1 my-2.5 h-px shrink-0 bg-white/12" />
              {navigation.secondary.map((item) => (
                <ShellSidebarLink item={item} key={item.href} pathname={pathname} />
              ))}
            </>
          )}
          <span className="min-h-4 flex-1" />
          {preview && (
            <div className="relative z-10 mb-2.5">
              <PreviewSwitch id="sc-preview-as" preview={preview} />
            </div>
          )}
          <div className="relative z-10 flex items-center gap-2.5 rounded-[12px] bg-white/[0.08] p-2.5 ring-1 ring-white/10">
            <span aria-hidden="true" className="grid size-[32px] shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-brand-forest">
              {viewer.initials}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs text-white">{viewer.displayName}</strong>
              <span className="block truncate text-[10.5px]">{scope}</span>
            </span>
          </div>
        </nav>
        <SidebarHills />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-header-line bg-[rgb(243_244_238/0.85)] backdrop-blur-md">
          <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 md:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <Link aria-label={t("shell.home")} className="shrink-0 rounded-md lg:hidden" href={homeHref}>
                <Image alt="" className="h-10 w-auto" height={180} priority src="/brand/sarvodaya-connect-wordmark.png" width={472} />
              </Link>
              <div className="min-w-0">
                <h1 className="break-words text-[19px] font-bold leading-tight tracking-[-0.01em] md:text-[21px]">{title}</h1>
                <p className="mt-0.5 break-words text-[12.5px] text-ink-soft">{subtitle}</p>
                <p className="sr-only">{t("shell.tagline")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {viewer.role === "HQ_ADMIN" && (
                // V5 HQTop: SarvoAI is HQ only (the API refuses every other role).
                <Link
                  className={`${styles.press} hidden items-center gap-1.5 rounded-[10px] bg-brand-forest px-3 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#174f34] sm:inline-flex`}
                  href="/sarvoai"
                >
                  <Icon className="size-4 text-[#f3c44e]" name="sparkle" />
                  <span>{askBefore}Sarvo<span className="text-[#f0a040]">AI</span>{askAfter}</span>
                </Link>
              )}
              <div className="hidden w-[280px] md:block">
                <GlobalSearchForm action={searchActionFor(viewer)} placeholder={searchPlaceholderFor(viewer, t)} />
              </div>
              {alerts ?? (
                <Link
                  aria-label={unreadCount > 0 ? t("shell.alertsNew", { count: unreadCount }) : t("shell.alerts")}
                  className="relative grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-leaf"
                  href="/notifications"
                >
                  <Icon className="size-5" name="bell" strokeWidth={2} />
                  {unreadCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute right-1 top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-danger-dot px-1 text-[9px] font-bold text-white ring-2 ring-canvas"
                    >
                      {unreadCount}
                    </span>
                  )}
                </Link>
              )}
              <form action={signOut}>
                <button
                  aria-label={t("shell.accountSignOut", { name: viewer.displayName })}
                  className={`${styles.press} grid size-10 place-items-center rounded-full bg-brand-forest text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--brand-mint-ring)]`}
                  type="submit"
                >
                  <Icon className="size-[18px]" name="user" strokeWidth={2} />
                </button>
              </form>
            </div>
            <div className="w-full md:hidden">
              <GlobalSearchForm action={searchActionFor(viewer)} placeholder={searchPlaceholderFor(viewer, t)} />
            </div>
          </div>
        </header>

        <nav aria-label={t("shell.mainNavigation")} className="bg-brand-forest px-4 py-2 lg:hidden">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[...navigation.main, ...navigation.secondary].map((item) => {
              const active = isActiveItem(item, pathname);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                    active ? "bg-brand-mint font-semibold text-brand-forest" : "text-sidebar-text hover:bg-white/10"
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
          {preview && (
            <div className="mt-2 max-w-xs">
              <PreviewSwitch id="sc-preview-as-mobile" preview={preview} />
            </div>
          )}
        </nav>

        <main className={`${styles.page} min-w-0 flex-1 px-4 pb-10 pt-5 md:px-7`} key={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
