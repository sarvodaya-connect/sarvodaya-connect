import Link from "next/link";

import { ChangedInV2Badge } from "@/components/dashboard/ui/changed-in-v2-badge";
import { Pill, type PillTone } from "@/components/dashboard/ui/pill";

const classification = [
  { label: "A · Strong", count: "2", color: "bg-[#26744b]" },
  { label: "B · Developing", count: "5", color: "bg-[#f0c328]" },
  { label: "C · Needs strengthening", count: "3", color: "bg-[#e88b2d]" },
  { label: "Not active / under review", count: "1", color: "bg-[#b8c0b8]" },
];

const wealthBreakdown = [
  { label: "Loans to members", value: "LKR 7.3M", color: "#183c2b" },
  { label: "Savings & deposits", value: "LKR 6.2M", color: "#26744b" },
  { label: "Fixed assets", value: "LKR 3.1M", color: "#8ab875" },
  { label: "SDF shares", value: "LKR 2.0M", color: "#f0c328" },
];

const sectorProgress = [
  { label: "Community Education & Mobilization", done: 38, plan: 42, color: "#e88b2d" },
  { label: "Child Wellbeing & Protection", done: 22, plan: 24, color: "#26744b" },
  { label: "Health & Nutrition", done: 6, plan: 14, color: "#15887a" },
];

const nextActivities = [
  { label: "Shramadana camp · Polgahawela SSS", date: "18 Oct 2026" },
  { label: "Clean-water awareness day · Giriulla SSS", date: "22 Oct 2026" },
  { label: "Pre-school parents' meeting · Ibbagamuwa SSS", date: "26 Oct 2026" },
];

type ReportStatus = "waiting-check" | "reported" | "not-reported";

const societyActivity: { society: string; sector: string; lastActivity: string; status: ReportStatus }[] = [
  { society: "Polgahawela SSS", sector: "Community Education & Mobilization", lastActivity: "28 Sep 2026", status: "waiting-check" },
  { society: "Ibbagamuwa SSS", sector: "Child Wellbeing & Protection", lastActivity: "05 Oct 2026", status: "reported" },
  { society: "Giriulla SSS", sector: "Health & Nutrition", lastActivity: "12 Aug 2026", status: "not-reported" },
  { society: "Pahala Kosgama SSS", sector: "Community Education & Mobilization", lastActivity: "05 Oct 2026", status: "waiting-check" },
  { society: "Wariyapola SSS", sector: "Child Wellbeing & Protection", lastActivity: "03 Oct 2026", status: "reported" },
  { society: "Bingiriya SSS", sector: "Health & Nutrition", lastActivity: "30 Aug 2026", status: "not-reported" },
  { society: "Nikaweratiya SSS", sector: "Child Wellbeing & Protection", lastActivity: "01 Oct 2026", status: "reported" },
  { society: "Kobeigane SSS", sector: "Community Education & Mobilization", lastActivity: "14 Aug 2026", status: "not-reported" },
];

const statusTone: Record<ReportStatus, { tone: PillTone; label: string }> = {
  "waiting-check": { tone: "under-review", label: "Waiting check" },
  reported: { tone: "approved", label: "Reported" },
  "not-reported": { tone: "not-reported", label: "Not reported" },
};

const compliance = [
  { label: "Child Wellbeing & Protection", pct: 100 },
  { label: "Community Education & Mobilisation", pct: 67 },
  { label: "Health & Nutrition", pct: 33 },
];

function Block({ action, children, eyebrow, title }: { action?: React.ReactNode; children: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 md:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-leaf">{eyebrow}</p>
          <h2 className="mt-1 text-sm font-semibold text-ink md:text-[15px]">{title}</h2>
        </div>
        {action && <div>{action}</div>}
      </header>
      <div className="px-5 py-5 md:px-6">{children}</div>
    </section>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <article className="rounded-tile border border-line bg-surface px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <strong className={`mt-2 block text-[28px] font-bold tracking-[-0.02em] md:text-[32px] ${warning ? "text-danger-text" : "text-ink"}`}>
        {value}
      </strong>
    </article>
  );
}

export function CoordinatorOverview() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-[-0.015em] text-ink md:text-2xl">My Programmes</h2>
            <ChangedInV2Badge />
          </div>
          <p className="mt-1 text-[12px] text-muted">S. Karunaratne · Social Programme Coordinator, Kurunegala</p>
          <p className="text-[11px] text-muted-ring">People · Communities · A part of the empowering society</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-medium text-ink-soft">
            <option>All my sectors</option>
          </select>
          <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-medium text-ink-soft">
            <option>Any status</option>
          </select>
          <select className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-medium text-ink-soft">
            <option>This month</option>
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Assigned societies" value="12" />
        <Metric label="Activity reports to show" value="5" />
        <Metric label="Not reported this month" value="3" warning />
        <Metric label="Issues flagged to DM" value="2" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Block eyebrow="1 · Societies by class" title="11 active of 12 assigned">
          <div
            aria-label="Societies by class: A 2, B 5, C 3, inactive 1"
            className="flex h-2.5 overflow-hidden rounded-full bg-[#e9ede5]"
            role="img"
          >
            <span className="w-[17%] bg-[#26744b]" />
            <span className="w-[42%] bg-[#f0c328]" />
            <span className="w-[25%] bg-[#e88b2d]" />
          </div>
          <ul className="mt-3 divide-y divide-line-soft text-[11px]">
            {classification.map((item) => (
              <li className="flex items-center justify-between py-2" key={item.label}>
                <span className="flex items-center gap-2 text-ink-soft">
                  <span className={`size-2 rounded-full ${item.color}`} />
                  {item.label}
                </span>
                <strong className="text-ink">{item.count}</strong>
              </li>
            ))}
          </ul>
        </Block>

        <Block eyebrow="2 · Total membership" title="1,084 members">
          <div
            aria-label="Female 59 percent; male 41 percent"
            className="flex h-2.5 overflow-hidden rounded-full"
            role="img"
          >
            <span className="w-[59%] bg-[#93458f]" />
            <span className="w-[41%] bg-[#28669a]" />
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px]">
            <span className="text-[#93458f]">● Female <strong>640 · 59%</strong></span>
            <span className="text-[#28669a]">● Male <strong>444 · 41%</strong></span>
          </div>
          <p className="mt-4 border-t border-line-soft pt-3 text-[11px] leading-5 text-muted">
            Child 152 · Youth 208 · Ordinary 640 · Life 44 · Invited 36
          </p>
        </Block>

        <Block eyebrow="3 · Wealth of the societies" title="LKR 18.6M">
          <div
            aria-label="Wealth composition"
            className="flex h-2.5 overflow-hidden rounded-full"
            role="img"
          >
            <span className="w-[39%] bg-[#183c2b]" />
            <span className="w-[33%] bg-[#26744b]" />
            <span className="w-[17%] bg-[#8ab875]" />
            <span className="w-[11%] bg-[#f0c328]" />
          </div>
          <ul className="mt-3 space-y-2 text-[11px]">
            {wealthBreakdown.map((item) => (
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
        <Block eyebrow="4 · Activity progress against planned" title="66 of 80 planned activities done · my 3 sectors">
          <div className="space-y-2.5">
            {sectorProgress.map((item) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_minmax(80px,0.8fr)_52px] items-center gap-3 text-[11px]"
                key={item.label}
              >
                <span className="truncate text-ink-soft">{item.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-[#edf0e8]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${item.done / item.plan * 100}%`, backgroundColor: item.color }}
                  />
                </span>
                <strong className="text-right text-ink-soft">{item.done} / {item.plan}</strong>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-semibold text-ink">Next planned activities</p>
          <ul className="mt-2 divide-y divide-line-soft">
            {nextActivities.map((item) => (
              <li className="flex items-center justify-between py-2 text-[11px]" key={item.label}>
                <span className="text-ink-soft">{item.label}</span>
                <span className="text-muted">{item.date}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block eyebrow="5 · Key stats · my villages" title="From village profiles">
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "3,140", label: "Households" },
              { value: "11,620", label: "Population" },
              { value: "17%", label: "Women-headed households" },
              { value: "34%", label: "Households on Aswesuma" },
            ].map((item) => (
              <div className="rounded-button border border-line bg-surface-wash p-3" key={item.label}>
                <strong className="block text-lg font-bold text-ink">{item.value}</strong>
                <span className="mt-1 block text-[10px] text-muted">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-semibold text-ink">Main livelihoods</p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full">
            <span className="w-[32%] bg-[#548b45]" />
            <span className="w-[24%] bg-[#e88b2d]" />
            <span className="w-[17%] bg-[#28669a]" />
            <span className="w-[14%] bg-[#7f4597]" />
            <span className="w-[13%] bg-[#c5ccc4]" />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-ink">Top priority issues</p>
          <ul className="mt-1 space-y-1 text-[11px] text-ink-soft">
            <li className="flex items-center justify-between"><span>Drinking water</span><strong className="text-ink">5 villages</strong></li>
            <li className="flex items-center justify-between"><span>Early childhood care</span><strong className="text-ink">4 villages</strong></li>
            <li className="flex items-center justify-between"><span>Youth unemployment</span><strong className="text-ink">3 villages</strong></li>
          </ul>
        </Block>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Block eyebrow="6 · Societies" title="8 shown">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="whitespace-nowrap border-b border-line-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Society</th>
                  <th className="whitespace-nowrap border-b border-line-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Sector</th>
                  <th className="whitespace-nowrap border-b border-line-soft px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Last activity</th>
                  <th className="whitespace-nowrap border-b border-line-soft px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">This month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {societyActivity.map((row) => {
                  const status = statusTone[row.status];
                  return (
                    <tr className="transition hover:bg-brand-mint-soft" key={row.society}>
                      <td className="px-4 py-3 text-[13px] font-semibold text-ink">{row.society}</td>
                      <td className="px-4 py-3 text-[12px] text-ink-soft">{row.sector}</td>
                      <td className="px-4 py-3 text-[12px] text-muted">{row.lastActivity}</td>
                      <td className="px-4 py-3 text-right"><Pill tone={status.tone}>{status.label}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Block>

        <Block eyebrow="7 · Observations" title="Add an observation">
          <label className="block text-[11px] font-semibold text-ink-soft">
            Society
            <select className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-[13px] text-ink">
              <option>Polgahawela SSS</option>
              <option>Ibbagamuwa SSS</option>
              <option>Giriulla SSS</option>
            </select>
          </label>
          <label className="mt-3 block text-[11px] font-semibold text-ink-soft">
            Note
            <textarea
              className="mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand-leaf focus:outline-none focus:ring-3 focus:ring-[#dbeadd]"
              placeholder="What did you see? What follow-up is needed?"
              rows={4}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-button border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft hover:bg-brand-mint-soft"
              type="button"
            >
              Save note
            </button>
            <button
              className="rounded-button bg-brand-action px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed"
              type="button"
            >
              Flag to District Manager
            </button>
          </div>
        </Block>
      </div>

      <div className="mt-4">
        <Block eyebrow="8 · Compliance" title="Sector participation & reporting compliance">
          <ul className="space-y-3">
            {compliance.map((item) => (
              <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_48px] items-center gap-3 text-[12px]" key={item.label}>
                <span className="text-ink-soft">{item.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[#edf0e8]">
                  <span className="block h-full rounded-full bg-brand-leaf" style={{ width: `${item.pct}%` }} />
                </span>
                <strong className="text-right text-ink">{item.pct}%</strong>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Share of assigned societies that reported at least one activity this month.</p>
        </Block>
      </div>

      <p className="mt-4 text-[10px] text-muted">
        <Link className="font-semibold text-brand-leaf hover:underline" href="/societies">Open my societies →</Link>
      </p>
    </>
  );
}
