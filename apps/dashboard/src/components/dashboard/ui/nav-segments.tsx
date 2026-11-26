"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useLayoutEffect, useRef, useState, useTransition } from "react";

import styles from "./nav-segments.module.css";

/**
 * Tabs and segmented choices that are ordinary links (they work without
 * JavaScript and keep the address), with an indicator that slides to the
 * chosen item at once while the next page loads. A small spinner says the
 * page is on its way; prefers-reduced-motion turns the slide off.
 */
export type SegmentItem = { href: string; key: string; label: ReactNode; count?: ReactNode; current: boolean };

type Box = { left: number; top: number; width: number; height: number };

function useIndicator(selected: string | undefined) {
  const container = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const item = selected ? container.current?.querySelector<HTMLElement>(`[data-segment="${CSS.escape(selected)}"]`) : null;
      setBox(item ? { left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight } : null);
      // On a phone a long row scrolls sideways: keep the chosen item in view, moving only the row.
      const row = container.current;
      if (item && row && row.scrollWidth > row.clientWidth) {
        const start = item.offsetLeft - 8;
        const end = item.offsetLeft + item.offsetWidth + 8 - row.clientWidth;
        if (row.scrollLeft > start) row.scrollLeft = start;
        else if (row.scrollLeft < end) row.scrollLeft = end;
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined" || !container.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [selected]);
  return { box, container };
}

/**
 * True when a link leads to the address already shown (path and query).
 * "Current" only styles a tab: a tab can be current for a nested page
 * (/work-plan/new) or a later page of a list (?page=2) and still lead somewhere.
 */
function isCurrentUrl(href: string) {
  const target = new URL(href, window.location.href);
  return target.pathname === window.location.pathname && target.search === window.location.search;
}

/** Moves to a link inside a transition, so the indicator moves first and the page follows. */
function useSegmentNavigation(items: SegmentItem[]) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);
  const current = items.find((item) => item.current)?.key;
  const shown = pending && chosen ? chosen : current;
  const onClick = (item: SegmentItem) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (isCurrentUrl(item.href)) return;
    setChosen(item.key);
    startTransition(() => router.push(item.href, { scroll: false }));
  };
  return { onClick, pending, shown };
}

function Spinner({ label }: { label?: string }) {
  return (
    <span aria-live="polite" className="inline-flex size-4 shrink-0 items-center">
      <svg aria-hidden="true" className={`${styles.spin} size-4 text-brand-leaf`} fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" opacity="0.25" r="9" stroke="currentColor" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Underlined tabs, such as a list's views ("All", "Not updated in 90+ days"…). */
export function TabLinks({ items, label, loadingLabel }: { items: SegmentItem[]; label: string; loadingLabel?: string }) {
  const { onClick, pending, shown } = useSegmentNavigation(items);
  const { box, container } = useIndicator(shown);
  return (
    <nav aria-label={label} className="flex items-center gap-2 border-b border-line">
      <div className="relative -mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" ref={container}>
        {box && (
          <span
            aria-hidden="true"
            className={`${styles.slide} pointer-events-none absolute bottom-0 left-0 h-[2.5px] rounded-full bg-brand-forest`}
            style={{ transform: `translateX(${box.left}px)`, width: box.width }}
          />
        )}
        {items.map((item) => {
          const active = item.key === shown;
          return (
            <Link
              aria-current={item.current ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2.5 text-[12.5px] font-semibold transition-colors duration-150 ${
                active ? "text-ink" : "text-ink-soft hover:bg-white/60 hover:text-ink"
              }`}
              data-segment={item.key}
              href={item.href}
              key={item.key}
              onClick={onClick(item)}
              scroll={false}
            >
              {item.label}
              {item.count !== undefined && (
                <span className={`rounded-full px-1.5 text-[10px] transition-colors ${active ? "bg-brand-forest text-white" : "bg-[#eef0eb] text-muted"}`}>{item.count}</span>
              )}
            </Link>
          );
        })}
      </div>
      {pending && <Spinner label={loadingLabel} />}
    </nav>
  );
}
