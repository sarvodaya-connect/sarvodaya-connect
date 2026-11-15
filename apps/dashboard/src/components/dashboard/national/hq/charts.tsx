"use client";

import { type ReactNode, useEffect, useState } from "react";

import styles from "./hq.module.css";

/**
 * True after the first paint, so charts can grow from zero once. Later
 * changes (a new reporting period) animate from the old values instead.
 */
export function useDrawn() {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return drawn;
}

export type DonutSegment = { key: string; value: number; colour: string };

/**
 * A ring split into segments. Decorative on its own: the caller always shows
 * the same numbers as text (a legend or table) next to it.
 */
export function Donut({
  centre,
  highlight,
  label,
  segments,
  size = 148,
  thickness = 16,
}: {
  centre?: ReactNode;
  highlight?: string | null;
  label: string;
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const drawn = useDrawn();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  // A small gap between segments, only when there is more than one.
  const visible = segments.filter((segment) => segment.value > 0);
  const gap = visible.length > 1 ? 1.2 : 0;
  let offset = 0;
  return (
    // The SVG sets the size itself: no inline widths, which the no-bars checks look for.
    <div className="relative inline-grid shrink-0">
      <svg aria-label={label} className="block -rotate-90" height={size} role="img" viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke="var(--line-soft)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((segment) => {
            const share = (segment.value / total) * 100;
            const length = Math.max(0, share - gap);
            const dash = drawn ? `${length} ${100 - length}` : `0 100`;
            const node = (
              <circle
                className={styles.donutSegment}
                cx={size / 2}
                cy={size / 2}
                fill="none"
                key={segment.key}
                opacity={highlight && highlight !== segment.key ? 0.28 : 1}
                pathLength={100}
                r={radius}
                stroke={segment.colour}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                strokeWidth={highlight === segment.key ? thickness + 3 : thickness}
              />
            );
            offset += share;
            return node;
          })}
      </svg>
      {centre && <div className="absolute inset-0 grid place-items-center text-center">{centre}</div>}
    </div>
  );
}

/** A single share as a ring, for "x of y". `value` is 0–100, or null when there is nothing to measure. */
export function Ring({
  children,
  colour = "var(--brand-leaf)",
  size = 64,
  thickness = 7,
  value,
}: {
  children?: ReactNode;
  colour?: string;
  size?: number;
  thickness?: number;
  value: number | null;
}) {
  const drawn = useDrawn();
  const radius = (size - thickness) / 2;
  const shown = drawn && value !== null ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <span className="relative inline-grid shrink-0 place-items-center">
      <svg aria-hidden="true" className="block -rotate-90" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke="var(--line-soft)" strokeWidth={thickness} />
        {value !== null && (
          <circle
            className={styles.ring}
            // A rounded end would still draw a dot at 0%.
            opacity={shown === 0 ? 0 : 1}
            cx={size / 2}
            cy={size / 2}
            fill="none"
            pathLength={100}
            r={radius}
            stroke={colour}
            strokeDasharray={`${shown} ${100 - shown}`}
            strokeLinecap="round"
            strokeWidth={thickness}
          />
        )}
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

export type ColumnSeries = { key: string; label: string; colour: string };
export type ColumnGroup = { key: string; label: string; values: Record<string, number>; description: string };

/**
 * Vertical grouped columns (never horizontal bars). Each group is focusable
 * and names its figures, so keyboard and screen-reader users get the same
 * numbers the tooltip shows; the full table sits next to the chart.
 */
export function Columns({ groups, height = 168, series }: { groups: ColumnGroup[]; height?: number; series: ColumnSeries[] }) {
  const drawn = useDrawn();
  const max = Math.max(1, ...groups.flatMap((group) => series.map((s) => group.values[s.key] ?? 0)));
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height }}>
        {[0, 1, 2, 3].map((line) => (
          <span className="block border-t border-dashed border-line-soft" key={line} />
        ))}
      </div>
      <ul className="relative grid items-end gap-3" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
        {groups.map((group) => (
          <li className="min-w-0" key={group.key}>
            <div
              aria-label={group.description}
              className={`${styles.columnGroup} ${styles.focusRing} relative flex items-end justify-center gap-1 rounded-md`}
              role="img"
              style={{ height }}
              tabIndex={0}
            >
              {series.map((s) => {
                const value = group.values[s.key] ?? 0;
                return (
                  <span
                    className={`${styles.column} block w-full max-w-[22px] rounded-t-[5px]`}
                    key={s.key}
                    style={{ backgroundColor: s.colour, height: "100%", ["--v" as string]: drawn ? value / max : 0 }}
                  />
                );
              })}
              <span className={`${styles.tooltip} absolute left-1/2 top-1 z-10 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10.5px] font-semibold text-white shadow`}>
                {series.map((s) => `${s.label} ${(group.values[s.key] ?? 0).toLocaleString("en-GB")}`).join(" · ")}
              </span>
            </div>
            <p className="mt-2 break-words text-center text-[10.5px] leading-tight text-ink-soft">{group.label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
