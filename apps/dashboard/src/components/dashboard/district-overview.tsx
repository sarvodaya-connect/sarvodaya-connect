import Link from "next/link";

import { Pill } from "@/components/dashboard/ui/pill";

const activities = [
  { label: "1 · Community Education & Mobilization", done: 48, plan: 52, color: "#e88b2d" },
  { label: "2 · Child Wellbeing & Protection", done: 36, plan: 40, color: "#26744b" },
  { label: "3 · Women Empowerment & Gender", done: 35, plan: 38, color: "#c72a69" },
  { label: "4 · New Economy – Youth, MSME", done: 41, plan: 50, color: "#28669a" },
  { label: "5 · Governance, Peace & Reconciliation", done: 18, plan: 24, color: "#7f4597" },
  { label: "6 · Health & Nutrition", done: 36, plan: 40, color: "#15887a" },
  { label: "7 · Disaster Response & Resilience", done: 16, plan: 18, color: "#315b8a" },
];

const waitingForReview = [
  { society: "Polgahawela SSS", kind: "Activity report · waiting 6 days", tone: "fast-target" as const, pill: "Past target" },
  { society: "Wariyapola SSS", kind: "Activity report · waiting 4 days", tone: "fast-target" as const, pill: "Past target" },
  { society: "Pahala Kosgama SSS", kind: "Council update · waiting 2 days", tone: "fast-target" as const, pill: "Near target" },
  { society: "Nikaweratiya SSS", kind: "Membership (Jul–Sep · waiting 1 day", tone: "on-time" as const, pill: "On time" },
];

const notUpdated = [
  { society: "Thalawa SSS", note: "Profile & membership · last updated 14 Mar 2026" },
  { society: "Giriulla SSS", note: "Membership counts · last updated 03 Apr 2026" },
  { society: "Boyawa SSS", note: "Executive Council · last updated 19 May 2026" },
  { society: "Kobeiyane SSS", note: "GPS location · last updated 30 May 2026" },
];

const activityLog = [
  { label: "Follow-up visit planned: audit records missing", meta: "Thalawa SSS · R. Fernando · Today, 09:40" },
  { label: "Approved Membership Jul-Sep", meta: "Nikaweratiya SSS · R. Fernando · Today, 08:35" },
  { label: "Coordinator flagged: committee not meeting", meta: "Polgahawela SSS · S. Karunaratne · Yesterday" },
  { label: "Returned activity report (missing photos)", meta: "Wariyapola SSS · R. Fernando · 10 Oct 2026" },
];

/**
 * Catalogue D02b block: numbered uppercase section title, then a large
 * headline figure ("98 active of 106 societies") with the rest of the body.
 */
function Block({ action, children, eyebrow, title }: { action?: React.ReactNode; children: React.ReactNode; eyebrow: string; title: string }) {
  const [number, ...rest] = eyebrow.split(" · ");
  const section = rest.join(" · ");
  // When the title is itself the section name (no figure), show it as the heading.
  const headingIsTitle = /^[A-Z][a-z]/.test(title) && !/^\d/.test(title) && !title.startsWith("LKR");
  // Currency figures stay whole ("LKR 168.2M"); otherwise the first word is the figure.
  const [figure, ...words] = title.startsWith("LKR ") ? [title] : title.split(" ");
  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 md:px-6">
        <h2 className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-forest">
          <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-brand-forest text-[10px] text-white">{number}</span>
          {headingIsTitle ? title : section}
        </h2>
        {action ? <div>{action}</div> : headingIsTitle && <span className="text-[11px] text-muted">{section}</span>}
      </header>
      <div className="px-5 pb-5 pt-3 md:px-6">
        {!headingIsTitle && (
          <p className="mb-3 flex flex-wrap items-baseline gap-x-2 text-[12px] text-muted">
            <strong className="text-[24px] font-bold tracking-[-0.02em] text-ink">{figure}</strong>
            {words.join(" ")}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

function Metric({ label, note, pill = false, value, warning = false }: { label: string; note: string; pill?: boolean; value: string; warning?: boolean }) {
  return (
    <article className="rounded-tile border border-line bg-surface px-4 py-3.5">
      <p className="text-[11px] text-muted">{label}</p>
      <strong className={`mt-1.5 block text-[24px] font-bold tracking-[-0.02em] ${warning ? "text-danger-text" : "text-ink"}`}>
        {value}
      </strong>
      {pill ? (
        <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-danger-bg px-2 py-0.5 text-[10px] font-semibold text-danger-text">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-danger-text" />
          {note}
        </span>
      ) : (
        <p className="mt-1 text-[11px] leading-4 text-muted">{note}</p>
      )}
    </article>
  );
}

export function DistrictCatalogueOverview() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-[-0.015em] text-ink md:text-[22px]">Good morning, R. Fernando</h2>
          </div>
          <p className="mt-1 text-[12px] text-muted">District Manager · Kurunegala · Friday 09 Oct 2026</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft transition hover:bg-brand-mint-soft"
            href="/districts/kurunegala"
          >
            District report
          </Link>
          <Link
            className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft transition hover:bg-brand-mint-soft"
            href="/districts/kurunegala"
          >
            Export district data
          </Link>
          <Link
            className="rounded-button bg-brand-action px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-action-pressed"
            href="/reviews"
          >
            Open review queue (14)
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Societies in district" value="106" note="98 active · A 14 · B 18 · C 66" />
        <Metric label="Waiting for my review" value="14" note="2 past target" pill />
        <Metric label="Not updated (90+ days)" value="12" note="Profile or membership stale" warning />
        <Metric label="Data verified" value="88%" note="National average 75%" />
        <Metric label="Audits overdue" value="9" note="FY 2025/26" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Block eyebrow="1 · Societies by class" title="98 active of 106 societies">
          <div
            aria-label="98 active: 14 class A, 18 class B, 66 class C; 8 inactive or under review"
            className="flex h-2.5 overflow-hidden rounded-full bg-[#e9ede5]"
            role="img"
          >
            <span className="w-[14%] bg-[#26744b]" />
            <span className="w-[18%] bg-[#f0c328]" />
            <span className="w-[66%] bg-[#e88b2d]" />
          </div>
          <ul className="mt-3 divide-y divide-line-soft text-[11px]">
            {[
              { label: "A · Strong", count: "14", color: "bg-[#26744b]" },
              { label: "B · Developing", count: "18", color: "bg-[#f0c328]" },
              { label: "C · Needs strengthening", count: "66", color: "bg-[#e88b2d]" },
              { label: "Not active / under review", count: "8", color: "bg-[#b8c0b8]" },
            ].map((item) => (
              <li className="flex items-center justify-between py-2" key={item.label}>
                <span className="flex items-center gap-2 text-ink-soft">
                  <span className={`size-2 rounded-full ${item.color}`} />
                  {item.label}
                </span>
                <strong className="text-ink">{item.count}</strong>
              </li>
            ))}
          </ul>
          <Link className="mt-2 inline-flex text-[11px] font-semibold text-brand-leaf hover:underline" href="/societies">
            View district societies →
          </Link>
        </Block>

        <Block eyebrow="2 · Total membership" title="9,412 members">
          <div
            aria-label="Female members 58 percent; male members 42 percent"
            className="flex h-2.5 overflow-hidden rounded-full"
            role="img"
          >
            <span className="w-[58%] bg-[#93458f]" />
            <span className="w-[42%] bg-[#28669a]" />
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px]">
            <span className="text-[#93458f]">● Female <strong>5,460 · 58%</strong></span>
            <span className="text-[#28669a]">● Male <strong>3,952 · 42%</strong></span>
          </div>
          <p className="mt-4 border-t border-line-soft pt-3 text-[11px] leading-5 text-muted">
            Child 1,310 · Youth 1,790 · Ordinary 5,620 · Life 560 · Invited 132
          </p>
        </Block>

        <Block eyebrow="3 · Wealth of the societies" title="LKR 168.2M">
          <div
            aria-label="Wealth composition: loans 40 percent, savings 33 percent, fixed assets 14 percent, shares 13 percent"
            className="flex h-2.5 overflow-hidden rounded-full"
            role="img"
          >
            <span className="w-[40%] bg-[#183c2b]" />
            <span className="w-[33%] bg-[#26744b]" />
            <span className="w-[14%] bg-[#8ab875]" />
            <span className="w-[13%] bg-[#f0c328]" />
          </div>
          <ul className="mt-3 space-y-2 text-[11px]">
            {[
              { label: "Loans to members", value: "LKR 67.3M", color: "#183c2b" },
              { label: "Savings & deposits", value: "LKR 55.5M", color: "#26744b" },
              { label: "Fixed assets", value: "LKR 23.5M", color: "#8ab875" },
              { label: "SDF shares", value: "LKR 21.9M", color: "#f0c328" },
            ].map((item) => (
              <li className="flex justify-between gap-2 text-ink-soft" key={item.label}>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <strong className="text-ink">{item.value}</strong>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Block eyebrow="4 · Activity progress against planned" title="312 of 358 planned activities done · 87%">
          <div className="space-y-2.5">
            {activities.map((item) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_minmax(80px,0.7fr)_52px] items-center gap-3 text-[11px]"
                key={item.label}
              >
                <span className="truncate text-ink-soft">{item.label}</span>
                <span
                  aria-label={`${item.done} of ${item.plan} activities complete`}
                  className="h-1.5 overflow-hidden rounded-full bg-[#edf0e8]"
                  role="img"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${item.done / item.plan * 100}%`, backgroundColor: item.color }}
                  />
                </span>
                <strong className="text-right text-ink-soft">{item.done} / {item.plan}</strong>
              </div>
            ))}
          </div>
          <p className="mt-3 text-right text-[10px] text-muted">FY 2025/26 · year to date</p>
        </Block>

        <Block eyebrow="5 · From village profiles" title="Key stats · villages in district">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "28,450", label: "Households" },
              { value: "104,300", label: "Population" },
              { value: "18%", label: "Women-headed households" },
              { value: "31%", label: "Households on Aswesuma" },
            ].map((item) => (
              <div className="rounded-button border border-line bg-surface-wash p-3" key={item.label}>
                <strong className="block text-lg font-bold text-ink">{item.value}</strong>
                <span className="mt-1 block text-[10px] text-muted">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-semibold text-ink-soft">Top priority issues</p>
          <ul className="mt-2 space-y-1 text-[11px] text-ink-soft">
            <li className="flex items-center justify-between"><span>Drinking water</span><strong className="text-ink">24 villages</strong></li>
            <li className="flex items-center justify-between"><span>Youth unemployment</span><strong className="text-ink">19 villages</strong></li>
            <li className="flex items-center justify-between"><span>Drought</span><strong className="text-ink">17 villages</strong></li>
          </ul>
        </Block>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Block
          action={
            <Link className="text-[11px] font-semibold text-brand-leaf hover:underline" href="/reviews">
              See all 14
            </Link>
          }
          eyebrow="6 · Waiting for review"
          title="4 priority items"
        >
          <ul className="divide-y divide-line-soft">
            {waitingForReview.map((item) => (
              <li className="flex items-center justify-between gap-3 py-3" key={item.society}>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{item.society}</p>
                  <p className="truncate text-[11px] text-muted">{item.kind}</p>
                </div>
                <Pill tone={item.tone}>{item.pill}</Pill>
              </li>
            ))}
          </ul>
        </Block>

        <Block eyebrow="7 · District map" title="Society locations">
          <div
            aria-hidden="true"
            className="relative mx-auto aspect-[4/3] max-w-[320px] overflow-hidden rounded-tile bg-surface-wash"
          >
            <svg className="h-full w-full" viewBox="0 0 320 240">
              <path
                d="M120 20 l80 15 l50 50 l30 70 l-20 60 l-70 20 l-80 -10 l-55 -40 l-20 -70 l25 -70 Z"
                fill="var(--brand-mint-soft)"
                stroke="var(--line)"
                strokeWidth="1.5"
              />
              {[
                [100, 70, "#26744b"],
                [170, 85, "#f0c328"],
                [200, 130, "#e88b2d"],
                [140, 150, "#e88b2d"],
                [95, 170, "#26744b"],
                [180, 180, "#f0c328"],
              ].map(([cx, cy, color]) => (
                <circle cx={cx} cy={cy} fill={color as string} key={`${cx}-${cy}`} r="5" stroke="#fff" strokeWidth="1.5" />
              ))}
            </svg>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">Dots are societies, coloured by class A / B / C</p>
          <Link className="mt-3 flex items-center justify-end text-[11px] font-semibold text-brand-leaf hover:underline" href="/districts/kurunegala">
            Open map →
          </Link>
        </Block>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Block eyebrow="8 · Not updated their information" title="4 societies need a reminder">
          <ul className="divide-y divide-line-soft">
            {notUpdated.map((item) => (
              <li className="flex items-center justify-between gap-3 py-3" key={item.society}>
                <div className="min-w-0">
                  <Link className="text-[13px] font-semibold text-ink hover:text-brand-leaf" href="/societies">
                    {item.society}
                  </Link>
                  <p className="truncate text-[11px] text-muted">{item.note}</p>
                </div>
                <button
                  className="rounded-button border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-soft transition hover:border-brand-leaf hover:text-brand-leaf"
                  type="button"
                >
                  Send reminder
                </button>
              </li>
            ))}
          </ul>
        </Block>

        <Block
          action={
            <button
              className="rounded-button bg-brand-action px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-action-pressed"
              type="button"
            >
              Add
            </button>
          }
          eyebrow="9 · District activity log & follow-ups"
          title="Recent updates"
        >
          <ul className="space-y-3">
            {activityLog.map((item) => (
              <li className="flex items-start gap-3" key={item.label}>
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-leaf" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{item.label}</p>
                  <p className="text-[11px] text-muted">{item.meta}</p>
                </div>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <p className="mt-4 text-[10px] text-muted">
        Demonstration figures are fictional and will be replaced by authorised API data.
      </p>
    </>
  );
}
