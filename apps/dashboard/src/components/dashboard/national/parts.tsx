import Link from "next/link";
import type { ReactNode } from "react";

import { Pill } from "@/components/dashboard/ui/pill";
import { sdgIconPath, sdgName } from "@/lib/sdg";

export const count = (value: number) => value.toLocaleString("en-GB");

/** "LKR 312.4 m" for totals of a million or more, "LKR 412,500" below. */
export function lkrShort(value: string | number | null) {
  if (value === null) return "Not added";
  const amount = Number(value);
  if (Math.abs(amount) >= 1_000_000) return `LKR ${(amount / 1_000_000).toLocaleString("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m`;
  return `LKR ${amount.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function share(part: number, whole: number) {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[11px] text-ink-soft">
      <Link className="text-[#2d5c88] underline underline-offset-2" href="/dashboard">National overview</Link>
      <span aria-hidden> › </span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export function PageTitle({ actions, description, title }: { actions?: ReactNode; description: ReactNode; title: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold text-ink">{title}</h1>
        <p className="text-[12px] text-ink-soft">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Shown only in demonstration mode, so seeded figures are never mistaken for real ones. */
export function SampleBadge({ demo, label = "Demonstration data" }: { demo: boolean; label?: string }) {
  return demo ? <Pill tone="preview">{label}</Pill> : null;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest">{children}</p>;
}

/** A card with the V5 eyebrow, title and an optional link at the top right. */
export function Panel({ children, eyebrow, link, title }: { children: ReactNode; eyebrow: string; link?: { href: string; label: string }; title: string }) {
  const id = `panel-${eyebrow.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex h-full flex-col rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-[15px] font-bold text-ink" id={id}>{title}</h2>
        </div>
        {link && (
          <Link className="shrink-0 text-[11px] font-semibold text-brand-forest underline-offset-2 hover:underline" href={link.href}>
            {link.label} ›
          </Link>
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export function Stat({ label, tone = "plain", value }: { label: ReactNode; tone?: "plain" | "female" | "male" | "profit" | "expenses" | "danger" | "warn"; value: string }) {
  const toneClass = {
    plain: "border-line bg-surface text-ink",
    female: "border-[#e4d3ec] bg-[#f6eff9] text-[#7a3f96]",
    male: "border-[#d3dcec] bg-[#eef2f9] text-[#2f5590]",
    profit: "border-[#cfe3d3] bg-[#eef6ef] text-brand-forest",
    expenses: "border-[#f0d9c4] bg-[#fdf3ea] text-[#9a4f12]",
    danger: "border-line bg-surface text-[#a8312a]",
    warn: "border-line bg-surface text-[#8a6100]",
  }[tone];
  return (
    <div className={`flex h-full flex-col rounded-tile border px-3.5 py-3 ${toneClass}`}>
      <strong className="text-[22px] font-bold leading-tight">{value}</strong>
      <span className="mt-1 text-[11px] text-ink-soft">{label}</span>
    </div>
  );
}

export const GRADE_STYLE = {
  A: { label: "A · Strong", colour: "#3f7d4f", text: "text-[#2f6b3e]" },
  B: { label: "B · Developing", colour: "#e1b84a", text: "text-[#8a6100]" },
  C: { label: "C · Needs strengthening", colour: "#de7c3a", text: "text-[#a2470f]" },
} as const;

export function GradeBadge({ grade }: { grade: "A" | "B" | "C" | null }) {
  if (!grade) return <span className="text-muted">—</span>;
  return (
    <span
      aria-label={`Grade ${grade}`}
      className="inline-flex size-6 items-center justify-center rounded-md text-[12px] font-bold text-white"
      style={{ backgroundColor: GRADE_STYLE[grade].colour }}
    >
      {grade}
    </span>
  );
}

/** "A 14 · B 18 · C 66" in the grade colours. */
export function GradeLine({ grades }: { grades: { A: number; B: number; C: number } }) {
  return (
    <span className="text-[11px] font-semibold">
      <span className={GRADE_STYLE.A.text}>A {grades.A}</span>
      <span className="text-muted"> · </span>
      <span className={GRADE_STYLE.B.text}>B {grades.B}</span>
      <span className="text-muted"> · </span>
      <span className={GRADE_STYLE.C.text}>C {grades.C}</span>
    </span>
  );
}

/** The official UN SDG icon with its rank and completed count. */
export function SdgTile({ completed, rank, sdg }: { completed: number; rank: number; sdg: number }) {
  return (
    <li className="flex h-full flex-col rounded-tile border border-line bg-surface p-2.5">
      <div className="flex items-start gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static official icon */}
        <img alt="" className="size-14 shrink-0 rounded" src={sdgIconPath(sdg)} />
        <div>
          <span className="text-[10px] text-muted">#{rank}</span>
          <strong className="block text-[20px] font-bold leading-tight text-ink">{count(completed)}</strong>
          <span className="text-[10px] text-muted">completed</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink">
        <strong>SDG {sdg}</strong> · {sdgName(sdg)}
      </p>
    </li>
  );
}

/** Financial-year links (FY 2025/26 …) that keep the other parameters. */
export function YearLinks({ current, href, years }: { current: number; href: (year: number) => string; years: number[] }) {
  return (
    <nav aria-label="Financial year" className="flex flex-wrap gap-1.5">
      {years.map((year) => (
        <Link
          aria-current={year === current ? "true" : undefined}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
            year === current ? "border-brand-forest bg-brand-forest text-white" : "border-line bg-surface text-ink-soft"
          }`}
          href={href(year)}
          key={year}
        >
          FY {year}/{String((year + 1) % 100).padStart(2, "0")}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ href, page, totalPages }: { href: (page: number) => string; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  return (
    <span className="flex gap-3">
      {page > 1 && <Link className="font-semibold text-brand-forest underline" href={href(page - 1)}>Previous</Link>}
      <span>Page {page} of {totalPages}</span>
      {page < totalPages && <Link className="font-semibold text-brand-forest underline" href={href(page + 1)}>Next</Link>}
    </span>
  );
}

export function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
