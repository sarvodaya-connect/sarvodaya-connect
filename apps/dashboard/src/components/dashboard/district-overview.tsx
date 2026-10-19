import Link from "next/link";

const activities = [
  { label: "Community Education & Mobilization", done: 48, plan: 52, color: "#e88b2d" },
  { label: "Child Wellbeing & Protection", done: 36, plan: 40, color: "#26744b" },
  { label: "Women Empowerment & Gender", done: 35, plan: 38, color: "#c72a69" },
  { label: "New Economy – Youth, MSME", done: 41, plan: 50, color: "#28669a" },
  { label: "Governance, Peace & Reconciliation", done: 18, plan: 24, color: "#7f4597" },
  { label: "Health & Nutrition", done: 36, plan: 40, color: "#15887a" },
  { label: "Disaster Response & Resilience", done: 16, plan: 18, color: "#315b8a" },
];

function Block({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return <section className="rounded-xl border border-[#dfe5dc] bg-white p-4 shadow-sm sm:p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#26744b]">{eyebrow}</p><h2 className="mt-2 text-sm font-semibold text-[#28382f]">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metric({ label, note, value, warning = false }: { label: string; note: string; value: string; warning?: boolean }) {
  return <article className="rounded-xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><p className="text-[10px] text-[#78857d]">{label}</p><strong className={`mt-2 block text-2xl font-bold tracking-tight ${warning ? "text-[#b33b36]" : "text-[#23362b]"}`}>{value}</strong><p className="mt-1 text-[10px] leading-4 text-[#78857d]">{note}</p></article>;
}

export function DistrictCatalogueOverview() {
  return <>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-lg font-semibold text-[#1d3025]">Good morning, R. Fernando</h2><p className="mt-1 text-[11px] text-[#78857d]">District Manager · Kurunegala · Friday 09 Oct 2026</p></div>
      <div className="flex flex-wrap gap-2"><Link className="rounded-lg border border-[#dfe5dc] bg-white px-3 py-2 text-[11px] font-medium text-[#344239] hover:bg-[#f7f8f5]" href="/districts/kurunegala">District report</Link><Link className="rounded-lg border border-[#dfe5dc] bg-white px-3 py-2 text-[11px] font-medium text-[#344239] hover:bg-[#f7f8f5]" href="/districts/kurunegala">Export district data</Link><Link className="rounded-lg bg-[#26744b] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#174a32]" href="/reviews">Open review queue (14)</Link></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Societies in district" value="106" note="98 active · A 14 · B 18 · C 66" />
      <Metric label="Waiting for my review" value="14" note="2 past target" />
      <Metric label="Not updated (90+ days)" value="12" note="Profile or membership stale" warning />
      <Metric label="Data verified" value="88%" note="National average 75%" />
      <Metric label="Audits overdue" value="9" note="FY 2025/26" warning />
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-3">
      <Block eyebrow="1 · Societies by class" title="98 active of 106 societies">
        <div aria-label="98 active: 14 class A, 18 class B, 66 class C; 8 inactive or under review" className="flex h-2.5 overflow-hidden rounded-full bg-[#e9ede5]" role="img"><span className="w-[14%] bg-[#26744b]"/><span className="w-[18%] bg-[#f0c328]"/><span className="w-[66%] bg-[#e88b2d]"/></div>
        <ul className="mt-3 divide-y divide-[#edf0eb] text-[10px]">{[{ label: "A · Strong", count: "14", color: "bg-[#26744b]" }, { label: "B · Developing", count: "18", color: "bg-[#f0c328]" }, { label: "C · Needs strengthening", count: "66", color: "bg-[#e88b2d]" }, { label: "Not active / under review", count: "8", color: "bg-[#b8c0b8]" }].map((item) => <li className="flex items-center justify-between py-2" key={item.label}><span className="flex items-center gap-2 text-[#526057]"><span className={`size-2 rounded-full ${item.color}`}/>{item.label}</span><strong className="text-[#344239]">{item.count}</strong></li>)}</ul>
        <Link className="mt-2 inline-flex text-[10px] font-semibold text-[#26744b] hover:underline" href="/societies">View district societies →</Link>
      </Block>
      <Block eyebrow="2 · Total membership" title="9,412 members">
        <div aria-label="Female members 58 percent; male members 42 percent" className="flex h-2.5 overflow-hidden rounded-full" role="img"><span className="w-[58%] bg-[#93458f]"/><span className="w-[42%] bg-[#28669a]"/></div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-[10px]"><span className="text-[#93458f]">● Female <strong>5,460 · 58%</strong></span><span className="text-[#28669a]">● Male <strong>3,952 · 42%</strong></span></div>
        <p className="mt-4 border-t border-[#edf0eb] pt-3 text-[10px] leading-5 text-[#78857d]">Child 1,310 · Youth 1,790 · Ordinary 5,620 · Life 560 · Invited 132</p>
      </Block>
      <Block eyebrow="3 · Wealth of the societies" title="LKR 168.2M">
        <div aria-label="Wealth composition: loans 40 percent, savings 33 percent, fixed assets 14 percent, shares 13 percent" className="flex h-2.5 overflow-hidden rounded-full" role="img"><span className="w-[40%] bg-[#183c2b]"/><span className="w-[33%] bg-[#26744b]"/><span className="w-[14%] bg-[#8ab875]"/><span className="w-[13%] bg-[#f0c328]"/></div>
        <ul className="mt-3 space-y-2 text-[10px]">{[{ label: "Loans to members", value: "LKR 67.3M", color: "#183c2b" }, { label: "Savings & deposits", value: "LKR 55.5M", color: "#26744b" }, { label: "Fixed assets", value: "LKR 23.5M", color: "#8ab875" }, { label: "SDF shares", value: "LKR 21.9M", color: "#f0c328" }].map((item) => <li className="flex justify-between gap-2 text-[#526057]" key={item.label}><span className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: item.color }}/>{item.label}</span><strong className="text-[#344239]">{item.value}</strong></li>)}</ul>
      </Block>
    </div>
    <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_1fr]">
      <Block eyebrow="4 · Activity progress against planned" title="312 of 358 planned activities done · 87%">
        <div className="space-y-2.5">{activities.map((item) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(80px,0.7fr)_38px] items-center gap-2 text-[10px]" key={item.label}><span className="truncate text-[#526057]">{item.label}</span><span aria-label={`${item.done} of ${item.plan} activities complete`} className="h-1.5 overflow-hidden rounded-full bg-[#edf0e8]" role="img"><span className="block h-full rounded-full" style={{ width: `${item.done / item.plan * 100}%`, backgroundColor: item.color }}/></span><strong className="text-right text-[#526057]">{item.done} / {item.plan}</strong></div>)}</div>
        <p className="mt-3 text-right text-[10px] text-[#929c95]">FY 2025/26 · year to date</p>
      </Block>
      <Block eyebrow="5 · From village profiles" title="Key stats · villages in district">
        <div className="grid grid-cols-2 gap-2">{[{ value: "28,450", label: "Households" }, { value: "104,300", label: "Population" }, { value: "18%", label: "Women-headed households" }, { value: "31%", label: "Households on Aswesuma" }].map((item) => <div className="rounded-lg border border-[#e7eae3] bg-[#fdfdfa] p-3" key={item.label}><strong className="block text-lg font-bold text-[#23362b]">{item.value}</strong><span className="mt-1 block text-[10px] text-[#78857d]">{item.label}</span></div>)}</div>
        <p className="mt-4 text-[10px] font-semibold text-[#344239]">Main livelihoods</p><div aria-label="Main livelihoods distribution" className="mt-2 flex h-2 overflow-hidden rounded-full"><span className="w-[34%] bg-[#548b45]"/><span className="w-[23%] bg-[#e88b2d]"/><span className="w-[18%] bg-[#28669a]"/><span className="w-[12%] bg-[#7f4597]"/><span className="w-[13%] bg-[#c5ccc4]"/></div>
        <Link className="mt-4 inline-flex text-[10px] font-semibold text-[#26744b] hover:underline" href="/districts/kurunegala">Open district map & society list →</Link>
      </Block>
    </div>
    <p className="mt-4 text-[10px] text-[#818c84]">Demonstration figures are fictional and will be replaced by authorised API data.</p>
  </>;
}
