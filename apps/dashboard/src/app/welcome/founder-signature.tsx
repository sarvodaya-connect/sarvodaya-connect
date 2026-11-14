"use client";

import { type CSSProperties, useId } from "react";

// Pen routes follow the supplied signature's ink. They reveal the original
// artwork through a mask rather than replacing it with an invented signature.
const NAME_STROKES = [
  { d: "M46 111 Q62 85 77 83 Q79 104 63 132 Q46 151 54 136 Q62 115 77 116 Q69 166 89 159 Q113 155 107 100 Q113 66 86 57 Q112 47 104 94 Q84 114 86 80 Q89 65 99 75 Q119 21 109 15", delay: 0.5, duration: 0.55 },
  { d: "M129 150 L130 150", delay: 1.05, duration: 0.06 },
  { d: "M181 55 L183 29 Q160 27 149 49 Q136 74 178 63 Q203 71 193 131 Q188 161 166 155 Q137 148 153 112 Q170 80 188 79 Q211 48 196 31 Q186 22 175 29", delay: 1.2, duration: 0.48 },
  { d: "M210 150 L212 150", delay: 1.69, duration: 0.06 },
  { d: "M260 89 Q264 104 244 119 Q231 98 250 77 Q280 44 282 75 Q284 105 242 160 Q280 145 316 162 Q329 113 314 116 Q300 118 290 136 M282 108 L276 201", delay: 1.85, duration: 0.48 },
  { d: "M367 69 Q382 34 355 32 Q323 32 311 69 Q300 99 327 91 M343 58 L341 119 Q342 158 355 155 Q376 152 372 117 Q369 87 343 97", delay: 2.34, duration: 0.44 },
  { d: "M405 85 Q382 105 386 141 Q394 170 411 124 Q415 146 426 150 Q446 137 430 111 Q424 95 414 95 Q430 67 447 76 Q465 92 452 122 Q447 134 438 129", delay: 2.79, duration: 0.4 },
  { d: "M495 28 Q489 68 469 121 Q459 150 474 151 Q490 147 497 116 Q502 90 486 95 Q473 95 470 110", delay: 3.2, duration: 0.28 },
  { d: "M512 105 Q523 68 539 99 Q554 124 514 153 Q504 151 511 132 Q528 97 555 95 Q575 95 552 157 M553 95 L569 16", delay: 3.49, duration: 0.35 },
  { d: "M579 100 Q598 65 604 88 Q607 102 589 122 Q576 136 574 131 Q576 159 597 156 Q626 139 607 115 Q600 106 593 117 M610 107 Q626 77 638 92 Q654 114 621 158", delay: 3.85, duration: 0.35 },
];

function penStyle(delay: number, duration: number): CSSProperties {
  return { "--stroke-delay": `${delay}s`, "--stroke-duration": `${duration}s` } as CSSProperties;
}

export function FounderSignature() {
  const id = useId().replaceAll(":", "");
  const nameMask = `${id}-name`;
  const flourishMask = `${id}-flourish`;
  return (
    <div aria-label="ඒ. ටී. ආරියරත්න" className="founder-entry-signature flex flex-col" lang="si" role="img">
      <svg aria-hidden="true" className="block h-auto w-full" viewBox="0 0 681 208">
        <defs>
          <mask id={nameMask} maskUnits="userSpaceOnUse" x="0" y="0" width="681" height="208">
            {NAME_STROKES.map(({ d, delay, duration }) => (
              <path className="founder-pen" d={d} fill="none" key={d} pathLength={1} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth={30} style={penStyle(delay, duration)} />
            ))}
          </mask>
        </defs>
        <image height="208" href="/founder/signature-name.webp" mask={`url(#${nameMask})`} width="681" />
      </svg>
      <svg aria-hidden="true" className="block h-auto w-full" viewBox="0 0 681 122">
        <defs>
          <mask id={flourishMask} maskUnits="userSpaceOnUse" x="0" y="0" width="681" height="122">
            <path className="founder-pen" d="M54 92 Q260 -4 529 13" fill="none" pathLength={1} stroke="white" strokeLinecap="round" strokeWidth={22} style={penStyle(4.25, 0.45)} />
            <path className="founder-pen" d="M567 16 L578 17" fill="none" pathLength={1} stroke="white" strokeLinecap="round" strokeWidth={36} style={penStyle(4.72, 0.08)} />
          </mask>
        </defs>
        <image height="122" href="/founder/signature-flourish.webp" mask={`url(#${flourishMask})`} width="681" />
      </svg>
    </div>
  );
}
