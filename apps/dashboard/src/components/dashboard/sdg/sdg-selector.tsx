"use client";

/* eslint-disable @next/next/no-img-element -- static official icons from /public/sdg */

import { sdgIconPath, sdgName, sdgTileLabel, UN_SDGS } from "@/lib/sdg";

/**
 * V5 SP07: the 17 official UN SDG icons in order, 9 per row on desktop. A
 * chosen goal has a dark ring and a tick; every tile says its number and full
 * title and announces whether it is selected.
 */
export function SdgSelector({
  disabled = false,
  name = "sdgs",
  onChange,
  selected,
}: {
  disabled?: boolean;
  name?: string;
  onChange: (next: number[]) => void;
  selected: number[];
}) {
  const toggle = (sdg: number) =>
    onChange(
      selected.includes(sdg) ? selected.filter((value) => value !== sdg) : [...selected, sdg].sort((a, b) => a - b),
    );
  return (
    <div>
      <ul aria-label="UN SDGs" className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 lg:grid-cols-9">
        {UN_SDGS.map(({ number }) => {
          const isSelected = selected.includes(number);
          return (
            <li key={number}>
              <button
                aria-label={sdgTileLabel(number, isSelected)}
                aria-pressed={isSelected}
                className="group flex w-full flex-col items-center gap-1.5 text-center disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled}
                onClick={() => toggle(number)}
                type="button"
              >
                <span
                  className={`relative block aspect-square w-full max-w-[96px] rounded-[6px] p-[3px] transition ${
                    isSelected ? "bg-[#1b2a22] shadow-[0_0_0_1px_#1b2a22]" : "bg-transparent group-hover:bg-line"
                  }`}
                >
                  <img alt="" className="block size-full rounded-[3px] object-cover" src={sdgIconPath(number)} />
                  {isSelected && (
                    <span
                      aria-hidden
                      className="absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-full border-2 border-white bg-[#2f6b45] text-white"
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className={`text-[11px] leading-tight ${isSelected ? "font-bold text-ink" : "text-ink-soft"}`}>
                  {number} · {sdgName(number)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected.map((sdg) => (
        <input key={sdg} name={name} type="hidden" value={sdg} />
      ))}
      <div aria-live="polite" className="mt-4 rounded-lg bg-[#f4f5f1] px-3 py-2.5 text-[11px]">
        <p className="text-muted">Chosen ({selected.length})</p>
        {selected.length === 0 ? (
          <p className="text-ink-soft">None yet. Choose at least one goal to approve.</p>
        ) : (
          selected.map((sdg) => (
            <p className="text-ink" key={sdg}>
              <strong>SDG {sdg}</strong> · {sdgName(sdg)}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
