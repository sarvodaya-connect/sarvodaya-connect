import type { ReactNode } from "react";

type WaveHeaderProps = {
  align?: "left" | "center";
  children?: ReactNode;
  eyebrow?: string;
  subtitle?: string;
  title: string;
};

/**
 * The forest-tinted wave + trees illustration used across dashboard screens
 * (D02, D02b, D02c, D03, D04, D06, D18 in Screen Catalogue v3).
 * Lives inline so there's no asset request, and so the SVG can scale freely.
 */
export function WaveHeader({ align = "left", children, eyebrow, subtitle, title }: WaveHeaderProps) {
  return (
    <header className="relative isolate overflow-hidden rounded-tile border border-line bg-surface-wash px-5 py-6 md:px-8 md:py-7">
      <WaveSvg />
      <div
        className={`relative z-10 flex min-h-[128px] flex-col gap-4 ${
          align === "center" ? "items-center text-center" : "justify-between"
        }`}
      >
        <div className={align === "center" ? "max-w-xl" : "min-w-0"}>
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-ring">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-brand-pine md:text-[28px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-[12px] text-ink-soft md:text-[13px]">{subtitle}</p>
          )}
        </div>
        {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </header>
  );
}

/** The SVG itself — exported so the shell can use it as a non-header backdrop. */
export function WaveSvg({ className = "pointer-events-none absolute inset-0 z-0 h-full w-full" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
      viewBox="0 0 1200 190"
    >
      <path d="M470 153 660 66l128 56 102-44 126 58 184-55v109H470Z" fill="var(--hill-50)" />
      <path d="M360 190c170-72 352-76 520-53 125 17 217-1 320-43v96Z" fill="var(--hill-200)" />
      <path d="M720 190c125-59 276-54 480-75v75Z" fill="var(--hill-400)" />
      <g fill="var(--hill-700)">
        <circle cx="1030" cy="137" r="23" />
        <circle cx="1082" cy="111" r="34" />
        <circle cx="1129" cy="145" r="25" />
        <circle cx="1180" cy="110" r="42" />
      </g>
      <g fill="var(--hill-900)">
        <circle cx="1074" cy="151" r="24" />
        <circle cx="1161" cy="153" r="29" />
      </g>
    </svg>
  );
}
