"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useLayoutEffect, useRef, useState, useTransition } from "react";

import { useI18n } from "@/i18n/provider";

import styles from "./hq.module.css";

type Thumb = { height: number; left: number; top: number; width: number };

/** Keeps a thumb under the chosen item, so the choice slides instead of jumping. */
function useThumb(selected: string) {
  const container = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const item = container.current?.querySelector<HTMLElement>(`[data-segment="${CSS.escape(selected)}"]`);
      if (item) {
        setThumb({ height: item.offsetHeight, left: item.offsetLeft, top: item.offsetTop, width: item.offsetWidth });
        // On a phone the years scroll sideways: keep the chosen one in view,
        // moving only this row, never the page.
        const row = container.current!;
        if (row.scrollWidth > row.clientWidth) {
          const start = item.offsetLeft - 8;
          const end = item.offsetLeft + item.offsetWidth + 8 - row.clientWidth;
          if (row.scrollLeft > start) row.scrollLeft = start;
          else if (row.scrollLeft < end) row.scrollLeft = end;
        }
      }
    };
    measure();
    // Longer Sinhala or Tamil labels, a font loading or a resize move the item.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [selected]);
  return { container, thumb };
}

function SegmentThumb({ dark, thumb }: { dark?: boolean; thumb: Thumb | null }) {
  if (!thumb) return null;
  return (
    <span
      aria-hidden="true"
      className={`${styles.segmentThumb} ${dark ? styles.segmentThumbDark : ""}`}
      style={{ height: thumb.height, transform: `translate(${thumb.left}px, ${thumb.top}px)`, width: thumb.width }}
    />
  );
}

/**
 * The financial year as a segmented control of links. Without JavaScript they
 * are ordinary links; with it, the chosen year moves at once and the current
 * figures stay on screen, dimmed, until the new year's arrive.
 */
export function PeriodSwitch({
  current,
  onPendingChange,
  years,
}: {
  current: number;
  onPendingChange: (pending: boolean) => void;
  years: number[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState(current);
  const shown = pending ? chosen : current;
  const { container, thumb } = useThumb(String(shown));

  useLayoutEffect(() => onPendingChange(pending), [onPendingChange, pending]);

  return (
    <div className="flex min-w-0 max-w-full items-center gap-2">
      <nav aria-label={t("n.financialYear")} className="min-w-0">
        <div className={`${styles.segmented} flex max-w-full gap-0.5 overflow-x-auto rounded-[11px] bg-[#e8ece4] p-[3px] [scrollbar-width:none]`} ref={container}>
          <SegmentThumb dark thumb={thumb} />
          {years.map((year) => {
            const active = year === shown;
            return (
              <Link
                aria-current={year === current ? "true" : undefined}
                className={`${styles.focusRing} relative shrink-0 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition-colors duration-200 ${
                  active ? "text-white" : "text-ink-soft hover:text-ink"
                }`}
                data-segment={year}
                href={`/dashboard?year=${year}`}
                key={year}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  if (year === current) return;
                  setChosen(year);
                  startTransition(() => router.push(`/dashboard?year=${year}`, { scroll: false }));
                }}
                scroll={false}
              >
                FY {year}/{String((year + 1) % 100).padStart(2, "0")}
              </Link>
            );
          })}
        </div>
      </nav>
      <span aria-live="polite" className="inline-flex min-w-4 items-center">
        {pending && (
          <>
            <svg aria-hidden="true" className={`${styles.spinner} size-4 text-brand-leaf`} fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" opacity="0.25" r="9" stroke="currentColor" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
            </svg>
            <span className="sr-only">{t("hq.loadingYear")}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** A small switch between two or three views of one chart. */
export function ViewToggle<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  value: T;
}) {
  const { container, thumb } = useThumb(value);
  return (
    <div aria-label={label} className={`${styles.segmented} inline-flex rounded-[10px] bg-[#eef1ea] p-[3px]`} ref={container} role="group">
      <SegmentThumb thumb={thumb} />
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={`${styles.focusRing} relative rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200 ${
            option.value === value ? "text-ink" : "text-muted hover:text-ink"
          }`}
          data-segment={option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
